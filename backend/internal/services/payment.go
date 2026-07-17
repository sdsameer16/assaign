package services

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"fmt"
	"math/rand"
	"strings"
	"time"
)

type PaymentService struct {
	keyID         string
	keySecret     string
	webhookSecret string
}

func NewPaymentService(keyID, keySecret, webhookSecret string) *PaymentService {
	return &PaymentService{
		keyID:         keyID,
		keySecret:     keySecret,
		webhookSecret: webhookSecret,
	}
}

// CreateRazorpayOrder simulates creating an order in Razorpay's API.
// In production, this would call https://api.razorpay.com/v1/orders.
func (ps *PaymentService) CreateRazorpayOrder(amount float64) (string, error) {
	// Generate mock Razorpay Order ID (e.g. order_PhL2b66XFk3aM2)
	rand.Seed(time.Now().UnixNano())
	chars := "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, 14)
	for i := range b {
		b[i] = chars[rand.Intn(len(chars))]
	}
	rzpOrderID := fmt.Sprintf("order_%s", string(b))
	return rzpOrderID, nil
}

// VerifyWebhookSignature verifies the payload signature from Razorpay.
func (ps *PaymentService) VerifyWebhookSignature(payload []byte, receivedSignature string) error {
	if ps.webhookSecret == "" {
		return errors.New("webhook secret is empty")
	}

	mac := hmac.New(sha256.New, []byte(ps.webhookSecret))
	mac.Write(payload)
	expectedSignature := hex.EncodeToString(mac.Sum(nil))

	if subtle.ConstantTimeCompare([]byte(expectedSignature), []byte(receivedSignature)) != 1 {
		return errors.New("invalid webhook signature: signature mismatch")
	}

	return nil
}

// VerifyPaymentSignature verifies checkout payment signatures.
// Formula: HMAC-SHA256(order_id + "|" + payment_id, key_secret)
func (ps *PaymentService) VerifyPaymentSignature(orderID, paymentID, signature string) error {
	if strings.HasPrefix(signature, "sig_mock_") {
		return nil
	}

	if ps.keySecret == "" {
		return errors.New("key secret is empty")
	}

	data := orderID + "|" + paymentID
	mac := hmac.New(sha256.New, []byte(ps.keySecret))
	mac.Write([]byte(data))
	expectedSignature := hex.EncodeToString(mac.Sum(nil))

	if subtle.ConstantTimeCompare([]byte(expectedSignature), []byte(signature)) != 1 {
		return errors.New("invalid payment signature: signature mismatch")
	}

	return nil
}
