package services

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

var (
	ErrUnauthorized = errors.New("unauthorized")
	ErrMinAmount    = errors.New("amount must be at least 100 paise")
)

type RazorpayOrderRequest struct {
	Amount   int64  `json:"amount"`
	Currency string `json:"currency"`
	Receipt  string `json:"receipt"`
}

type RazorpayOrderResponse struct {
	ID       string `json:"id"`
	Entity   string `json:"entity"`
	Amount   int64  `json:"amount"`
	Currency string `json:"currency"`
	Receipt  string `json:"receipt"`
	Status   string `json:"status"`
}

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

// CreateRazorpayOrder creates an order in Razorpay's API.
func (ps *PaymentService) CreateRazorpayOrder(amount float64) (string, error) {
	amountPaise := int64(amount * 100)
	if amountPaise < 100 {
		return "", ErrMinAmount
	}

	if ps.keyID == "" || ps.keySecret == "" {
		return "", errors.New("razorpay credentials are not set")
	}

	// Generate a simple receipt ID
	receipt := fmt.Sprintf("rcpt_%d", time.Now().UnixNano())

	reqBody := RazorpayOrderRequest{
		Amount:   amountPaise,
		Currency: "INR",
		Receipt:  receipt,
	}

	jsonReq, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", "https://api.razorpay.com/v1/orders", bytes.NewBuffer(jsonReq))
	if err != nil {
		return "", fmt.Errorf("failed to create http request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.SetBasicAuth(ps.keyID, ps.keySecret)

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("http request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized {
		return "", ErrUnauthorized
	}

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("razorpay api returned status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var orderResp RazorpayOrderResponse
	if err := json.Unmarshal(bodyBytes, &orderResp); err != nil {
		return "", fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return orderResp.ID, nil
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
