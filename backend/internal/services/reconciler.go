package services

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"campusbites/backend/internal/database"
	"campusbites/backend/internal/models"
)

type ConfirmPaymentFunc func(
	ctx context.Context,
	razorpayOrderID string,
	razorpayPaymentID string,
	razorpaySignature string,
	source string,
	amountPaise int64,
	currency string,
	webhookLog string,
) error

type PaymentReconciler struct {
	db             *database.DB
	paymentService *PaymentService
	confirmFn      ConfirmPaymentFunc
}

func NewPaymentReconciler(db *database.DB, ps *PaymentService, confirmFn ConfirmPaymentFunc) *PaymentReconciler {
	return &PaymentReconciler{
		db:             db,
		paymentService: ps,
		confirmFn:      confirmFn,
	}
}

// Start begins the periodic reconciliation worker loop
func (r *PaymentReconciler) Start(ctx context.Context, interval time.Duration) {
	log.Printf("[PaymentReconciler] Background reconciler worker started (polling interval: %v)", interval)
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	// Run initial pass on startup
	if err := r.ReconcilePendingPayments(ctx); err != nil {
		log.Printf("[PaymentReconciler] Initial reconciliation pass error: %v", err)
	}

	for {
		select {
		case <-ctx.Done():
			log.Println("[PaymentReconciler] Worker stopped")
			return
		case <-ticker.C:
			if err := r.ReconcilePendingPayments(ctx); err != nil {
				log.Printf("[PaymentReconciler] Error during reconciliation cycle: %v", err)
			}
		}
	}
}

// ReconcilePendingPayments queries unconfirmed orders and checks real-time status with Razorpay
func (r *PaymentReconciler) ReconcilePendingPayments(ctx context.Context) error {
	// Find payments in 'created', 'payment_pending', or 'failed' status created between 2 minutes and 48 hours ago
	query := `
		SELECT p.id, p.order_id, p.razorpay_order_id, p.amount, p.status::text, o.status::text
		FROM payments p
		JOIN orders o ON o.id = p.order_id
		WHERE p.status IN ('created', 'payment_pending', 'failed')
		  AND p.created_at < NOW() - INTERVAL '2 minutes'
		  AND p.created_at > NOW() - INTERVAL '48 hours'
		ORDER BY p.created_at ASC
		LIMIT 50
	`

	rows, err := r.db.Pool.Query(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to query pending payments for reconciliation: %w", err)
	}
	defer rows.Close()

	type pendingPay struct {
		paymentID       string
		orderID         string
		razorpayOrderID string
		amount          float64
		payStatus       string
		orderStatus     string
	}

	var list []pendingPay
	for rows.Next() {
		var item pendingPay
		if err := rows.Scan(&item.paymentID, &item.orderID, &item.razorpayOrderID, &item.amount, &item.payStatus, &item.orderStatus); err == nil {
			list = append(list, item)
		}
	}
	rows.Close()

	for _, item := range list {
		r.reconcileSinglePayment(ctx, item.paymentID, item.orderID, item.razorpayOrderID, item.amount, item.payStatus, item.orderStatus)
	}

	return nil
}

func (r *PaymentReconciler) reconcileSinglePayment(
	ctx context.Context,
	paymentID string,
	orderID string,
	razorpayOrderID string,
	amount float64,
	payStatus string,
	orderStatus string,
) {
	if razorpayOrderID == "" {
		return
	}

	paymentsList, err := r.paymentService.FetchRazorpayOrderPayments(razorpayOrderID)
	if err != nil {
		// Log reconciliation error
		errMsg := fmt.Sprintf("Failed to query Razorpay REST API: %v", err)
		log.Printf("[PaymentReconciler] %s for Order %s", errMsg, razorpayOrderID)
		_, _ = r.db.Pool.Exec(ctx, `
			UPDATE payments
			SET last_reconciliation_error = $1,
			    last_reconciliation_at = NOW(),
			    reconciliation_attempt_count = reconciliation_attempt_count + 1
			WHERE id = $2
		`, errMsg, paymentID)
		return
	}

	var capturedPayment *RazorpayPaymentEntity
	for _, p := range paymentsList {
		if strings.ToLower(p.Status) == "captured" || strings.ToLower(p.Status) == "paid" || p.Captured {
			capturedPayment = &p
			break
		}
	}

	if capturedPayment != nil {
		// Pattern A / Pattern B Recovery! Razorpay payment is CAPTURED but DB is CREATED/FAILED
		log.Printf("[PaymentReconciler] RECOVERY DISCOVERED! Razorpay Order %s has captured payment %s. Auto-reconciling DB status %s...", razorpayOrderID, capturedPayment.ID, payStatus)

		err := r.confirmFn(
			ctx,
			razorpayOrderID,
			capturedPayment.ID,
			"",
			"background_reconciler",
			capturedPayment.Amount,
			capturedPayment.Currency,
			"",
		)
		if err != nil {
			log.Printf("[PaymentReconciler] Auto-reconciliation failed for Razorpay Order %s: %v", razorpayOrderID, err)
			_, _ = r.db.Pool.Exec(ctx, `
				UPDATE payments
				SET last_reconciliation_error = $1,
				    last_reconciliation_at = NOW(),
				    reconciliation_attempt_count = reconciliation_attempt_count + 1
				WHERE id = $2
			`, err.Error(), paymentID)
		} else {
			log.Printf("[PaymentReconciler] RECOVERY SUCCESSFUL! Razorpay Order %s successfully recovered and marked PAID.", razorpayOrderID)
		}
	} else if len(paymentsList) == 0 {
		// No payments attempted. Check if stale (>30 mins)
		var createdAt time.Time
		_ = r.db.Pool.QueryRow(ctx, "SELECT created_at FROM payments WHERE id = $1", paymentID).Scan(&createdAt)
		if time.Since(createdAt) > 30*time.Minute {
			log.Printf("[PaymentReconciler] Razorpay Order %s has no payments after 30m. Marking failed.", razorpayOrderID)
			_, _ = r.db.Pool.Exec(ctx, `
				UPDATE payments
				SET status = $1,
				    last_reconciliation_at = NOW(),
				    reconciliation_notes = 'Expired with zero payment attempts after 30m'
				WHERE id = $2 AND status IN ('created', 'payment_pending')
			`, models.PaymentStatusFailed, paymentID)
			_, _ = r.db.Pool.Exec(ctx, `UPDATE orders SET status = $1 WHERE id = $2 AND status = $3`, models.OrderStatusCancelled, orderID, models.OrderStatusReceived)
		}
	} else {
		// Payment attempts exist but none captured yet
		log.Printf("[PaymentReconciler] Razorpay Order %s has %d payment attempts, none captured yet.", razorpayOrderID, len(paymentsList))
		_, _ = r.db.Pool.Exec(ctx, `
			UPDATE payments
			SET last_reconciliation_at = NOW(),
			    reconciliation_attempt_count = reconciliation_attempt_count + 1,
			    razorpay_status = $1
			WHERE id = $2
		`, paymentsList[0].Status, paymentID)
	}
}
