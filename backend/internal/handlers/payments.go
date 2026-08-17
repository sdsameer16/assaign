package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"campusbites/backend/internal/models"
	"github.com/jackc/pgx/v5"
)

// ConfirmPaymentAndOrder is the single, thread-safe, idempotent core handler
// for confirming payments and recovering orders across Frontend callbacks, Webhooks,
// Background Reconciler runs, and Admin manual triggers.
func (h *HandlerContext) ConfirmPaymentAndOrder(
	ctx context.Context,
	razorpayOrderID string,
	razorpayPaymentID string,
	razorpaySignature string,
	source string,
	amountPaise int64,
	currency string,
	webhookLog string,
) error {
	if strings.TrimSpace(razorpayOrderID) == "" {
		return fmt.Errorf("razorpay_order_id cannot be empty")
	}

	tx, err := h.DB.Pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Acquire ROW LOCK (SELECT FOR UPDATE) on payments & orders
	var (
		paymentID         string
		orderID           string
		currentPayStatus  string
		existingPayID     string
		orderStatus       string
		studentID         string
		orderTotalAmount  float64
	)

	queryLock := `
		SELECT p.id, p.order_id, p.status::text, COALESCE(p.razorpay_payment_id, ''),
		       o.status::text, o.student_id, o.total_amount
		FROM payments p
		JOIN orders o ON o.id = p.order_id
		WHERE p.razorpay_order_id = $1
		FOR UPDATE OF p, o
	`
	err = tx.QueryRow(ctx, queryLock, razorpayOrderID).Scan(
		&paymentID,
		&orderID,
		&currentPayStatus,
		&existingPayID,
		&orderStatus,
		&studentID,
		&orderTotalAmount,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			return fmt.Errorf("no payment record found for razorpay_order_id: %s", razorpayOrderID)
		}
		return fmt.Errorf("failed to query payment row lock: %w", err)
	}

	// 1. Amount & Currency Validation
	expectedPaise := int64(orderTotalAmount * 100)
	if amountPaise > 0 && amountPaise != expectedPaise {
		note := fmt.Sprintf("CRITICAL: Amount mismatch! Expected %d paise (₹%.2f), received %d paise. Source: %s", expectedPaise, orderTotalAmount, amountPaise, source)
		log.Printf("[PaymentReconciliation] %s for Razorpay Order %s", note, razorpayOrderID)

		_, _ = tx.Exec(ctx, `
			UPDATE payments
			SET status = $1,
			    reconciliation_notes = $2,
			    last_reconciliation_error = $2,
			    last_reconciliation_at = NOW(),
			    reconciliation_attempt_count = reconciliation_attempt_count + 1
			WHERE id = $3
		`, models.PaymentStatusReconciliationRequired, note, paymentID)
		_ = tx.Commit(ctx)
		return fmt.Errorf("payment amount mismatch: expected %d paise, received %d paise", expectedPaise, amountPaise)
	}

	if currency != "" && strings.ToUpper(currency) != "INR" {
		note := fmt.Sprintf("CRITICAL: Currency mismatch! Expected INR, received %s. Source: %s", currency, source)
		log.Printf("[PaymentReconciliation] %s for Razorpay Order %s", note, razorpayOrderID)

		_, _ = tx.Exec(ctx, `
			UPDATE payments
			SET status = $1,
			    reconciliation_notes = $2,
			    last_reconciliation_error = $2,
			    last_reconciliation_at = NOW(),
			    reconciliation_attempt_count = reconciliation_attempt_count + 1
			WHERE id = $3
		`, models.PaymentStatusReconciliationRequired, note, paymentID)
		_ = tx.Commit(ctx)
		return fmt.Errorf("payment currency mismatch: expected INR, received %s", currency)
	}

	// 2. 3-Level Ownership Validation Check
	if razorpayPaymentID != "" && existingPayID != "" && existingPayID != razorpayPaymentID {
		log.Printf("[PaymentReconciliation] Warning: Razorpay Payment ID mismatch for Order %s (existing: %s, new: %s)", razorpayOrderID, existingPayID, razorpayPaymentID)
	}

	// 3. Idempotency Check: If already paid, update metadata cleanly and return
	if currentPayStatus == models.PaymentStatusPaid {
		updateMeta := `
			UPDATE payments
			SET razorpay_payment_id = COALESCE(NULLIF($1, ''), razorpay_payment_id),
			    razorpay_signature = COALESCE(NULLIF($2, ''), razorpay_signature),
			    last_reconciliation_at = NOW(),
			    webhook_log = CASE WHEN $3 != '' THEN $3::jsonb ELSE webhook_log END
			WHERE id = $4
		`
		_, _ = tx.Exec(ctx, updateMeta, razorpayPaymentID, razorpaySignature, webhookLog, paymentID)
		if err := tx.Commit(ctx); err != nil {
			return fmt.Errorf("failed to commit idempotent payment update: %w", err)
		}
		log.Printf("[PaymentConfirmed] Idempotent payment confirmation for order %s (source: %s)", razorpayOrderID, source)
		return nil
	}

	// 4. Update Payment status to PAID
	updatePaymentSQL := `
		UPDATE payments
		SET status = $1,
		    razorpay_payment_id = COALESCE(NULLIF($2, ''), razorpay_payment_id),
		    razorpay_signature = COALESCE(NULLIF($3, ''), razorpay_signature),
		    reconciled_at = NOW(),
		    reconciliation_notes = $4,
		    reconciliation_source = $5,
		    razorpay_status = 'captured',
		    last_reconciliation_at = NOW(),
		    webhook_log = CASE WHEN $6 != '' THEN $6::jsonb ELSE webhook_log END
		WHERE id = $7
	`
	notes := fmt.Sprintf("Payment confirmed successfully via %s at %s", source, time.Now().Format(time.RFC3339))
	_, err = tx.Exec(ctx, updatePaymentSQL, models.PaymentStatusPaid, razorpayPaymentID, razorpaySignature, notes, source, webhookLog, paymentID)
	if err != nil {
		return fmt.Errorf("failed to update payment record to paid: %w", err)
	}

	// 5. Recover/Confirm Order Status if needed
	// If order was cancelled by stale cleanup or still in received status, confirm it!
	if orderStatus == models.OrderStatusCancelled || orderStatus == models.OrderStatusReceived || orderStatus == models.OrderStatusOutOfStock {
		updateOrderSQL := `UPDATE orders SET status = $1 WHERE id = $2`
		_, err = tx.Exec(ctx, updateOrderSQL, models.OrderStatusReceived, orderID)
		if err != nil {
			return fmt.Errorf("failed to update order status to received: %w", err)
		}

		insertHistorySQL := `
			INSERT INTO order_status_history (order_id, status, changed_by, changed_at)
			VALUES ($1, $2, $3, NOW())
		`
		_, err = tx.Exec(ctx, insertHistorySQL, orderID, models.OrderStatusReceived, studentID)
		if err != nil {
			return fmt.Errorf("failed to insert order status history: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit transaction for order confirmation: %w", err)
	}

	// 6. Trigger Push Notification to Student
	if h.FCMService != nil {
		var fcmToken string
		_ = h.DB.Pool.QueryRow(ctx, "SELECT fcm_token FROM students WHERE id = $1 AND fcm_token IS NOT NULL", studentID).Scan(&fcmToken)
		if fcmToken != "" {
			_ = h.FCMService.SendToUser(ctx, fcmToken, "Order Received!", "Your payment was successful and your order is confirmed.")
		}
	}

	log.Printf("[PaymentConfirmed] Successfully confirmed payment for Razorpay Order %s (Internal Order %s) via %s", razorpayOrderID, orderID, source)
	return nil
}

// RazorpayWebhook handles payment.captured and order.paid events from Razorpay.
func (h *HandlerContext) RazorpayWebhook(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "failed to read webhook body")
		return
	}

	signature := r.Header.Get("X-Razorpay-Signature")
	if err := h.PaymentService.VerifyWebhookSignature(body, signature); err != nil {
		RespondError(w, http.StatusUnauthorized, "invalid webhook signature")
		return
	}

	var event struct {
		Event   string `json:"event"`
		Payload struct {
			Payment struct {
				Entity struct {
					ID       string `json:"id"`
					OrderID  string `json:"order_id"`
					Status   string `json:"status"`
					Amount   int64  `json:"amount"`
					Currency string `json:"currency"`
				} `json:"entity"`
			} `json:"payment"`
			Order struct {
				Entity struct {
					ID     string `json:"id"`
					Amount int64  `json:"amount"`
				} `json:"entity"`
			} `json:"order"`
		} `json:"payload"`
	}

	if err := json.Unmarshal(body, &event); err != nil {
		RespondError(w, http.StatusBadRequest, "invalid webhook payload")
		return
	}

	ctx := r.Context()
	switch event.Event {
	case "payment.captured":
		rzpOrderID := event.Payload.Payment.Entity.OrderID
		rzpPaymentID := event.Payload.Payment.Entity.ID
		amountPaise := event.Payload.Payment.Entity.Amount
		currency := event.Payload.Payment.Entity.Currency

		if rzpOrderID == "" {
			RespondJSON(w, http.StatusOK, map[string]string{"status": "ignored", "reason": "empty order_id"})
			return
		}

		err := h.ConfirmPaymentAndOrder(ctx, rzpOrderID, rzpPaymentID, "", "webhook", amountPaise, currency, string(body))
		if err != nil {
			log.Printf("[RazorpayWebhookError] Error processing payment.captured webhook: %v", err)
			// Return HTTP 500 Internal Server Error so Razorpay knows to RETRY delivery!
			RespondError(w, http.StatusInternalServerError, "failed to process webhook: "+err.Error())
			return
		}

	case "order.paid":
		rzpOrderID := event.Payload.Order.Entity.ID
		amountPaise := event.Payload.Order.Entity.Amount
		if rzpOrderID == "" {
			RespondJSON(w, http.StatusOK, map[string]string{"status": "ignored", "reason": "empty order_id"})
			return
		}

		err := h.ConfirmPaymentAndOrder(ctx, rzpOrderID, "", "", "webhook", amountPaise, "INR", string(body))
		if err != nil {
			log.Printf("[RazorpayWebhookError] Error processing order.paid webhook: %v", err)
			// Return HTTP 500 Internal Server Error so Razorpay knows to RETRY delivery!
			RespondError(w, http.StatusInternalServerError, "failed to process webhook: "+err.Error())
			return
		}

	default:
		RespondJSON(w, http.StatusOK, map[string]string{"status": "ignored", "event": event.Event})
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
