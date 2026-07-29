package handlers

import (
	"context"
	"encoding/json"
	"io"
	"net/http"

	"campusbites/backend/internal/models"
)

// RazorpayWebhook handles payment.captured / order.paid events and marks payments paid.
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
					ID      string `json:"id"`
					OrderID string `json:"order_id"`
					Status  string `json:"status"`
				} `json:"entity"`
			} `json:"payment"`
			Order struct {
				Entity struct {
					ID string `json:"id"`
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
		if rzpOrderID == "" {
			RespondJSON(w, http.StatusOK, map[string]string{"status": "ignored"})
			return
		}
		if err := h.markPaymentPaidByRazorpayOrder(ctx, rzpOrderID, rzpPaymentID, string(body)); err != nil {
			RespondError(w, http.StatusInternalServerError, "failed to update payment")
			return
		}
	case "order.paid":
		rzpOrderID := event.Payload.Order.Entity.ID
		if rzpOrderID == "" {
			RespondJSON(w, http.StatusOK, map[string]string{"status": "ignored"})
			return
		}
		if err := h.markPaymentPaidByRazorpayOrder(ctx, rzpOrderID, "", string(body)); err != nil {
			RespondError(w, http.StatusInternalServerError, "failed to update payment")
			return
		}
	default:
		RespondJSON(w, http.StatusOK, map[string]string{"status": "ignored"})
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *HandlerContext) markPaymentPaidByRazorpayOrder(ctx context.Context, razorpayOrderID, razorpayPaymentID, webhookLog string) error {
	query := `
		UPDATE payments
		SET status = $1,
		    razorpay_payment_id = COALESCE(NULLIF($2, ''), razorpay_payment_id),
		    webhook_log = $3::jsonb
		WHERE razorpay_order_id = $4 AND status IN ('created', 'paid')
	`
	_, err := h.DB.Pool.Exec(ctx, query, models.PaymentStatusPaid, razorpayPaymentID, webhookLog, razorpayOrderID)
	return err
}
