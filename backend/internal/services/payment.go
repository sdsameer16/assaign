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

// GetKeyID returns the configured Razorpay Key ID.
func (ps *PaymentService) GetKeyID() string {
	if ps == nil {
		return ""
	}
	return ps.keyID
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



type RazorpayPaymentEntity struct {
	ID          string `json:"id"`
	Entity      string `json:"entity"`
	Amount      int64  `json:"amount"`
	Currency    string `json:"currency"`
	Status      string `json:"status"`
	OrderID     string `json:"order_id"`
	Method      string `json:"method"`
	Captured    bool   `json:"captured"`
	Description string `json:"description"`
}

type RazorpayPaymentsListResponse struct {
	Entity string                  `json:"entity"`
	Count  int                     `json:"count"`
	Items  []RazorpayPaymentEntity `json:"items"`
}

// FetchRazorpayOrderPayments retrieves all payments associated with a Razorpay Order ID.
func (ps *PaymentService) FetchRazorpayOrderPayments(razorpayOrderID string) ([]RazorpayPaymentEntity, error) {
	if razorpayOrderID == "" {
		return nil, errors.New("razorpay order id is empty")
	}
	if ps.keyID == "" || ps.keySecret == "" {
		return nil, errors.New("razorpay credentials are not set")
	}

	url := fmt.Sprintf("https://api.razorpay.com/v1/orders/%s/payments", razorpayOrderID)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create http request: %w", err)
	}

	req.SetBasicAuth(ps.keyID, ps.keySecret)
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http request failed: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("razorpay api status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var listResp RazorpayPaymentsListResponse
	if err := json.Unmarshal(bodyBytes, &listResp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal payments list: %w", err)
	}

	return listResp.Items, nil
}

// FetchRazorpayPayment retrieves payment details for a specific Razorpay Payment ID.
func (ps *PaymentService) FetchRazorpayPayment(razorpayPaymentID string) (*RazorpayPaymentEntity, error) {
	if razorpayPaymentID == "" {
		return nil, errors.New("razorpay payment id is empty")
	}
	if ps.keyID == "" || ps.keySecret == "" {
		return nil, errors.New("razorpay credentials are not set")
	}

	url := fmt.Sprintf("https://api.razorpay.com/v1/payments/%s", razorpayPaymentID)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create http request: %w", err)
	}

	req.SetBasicAuth(ps.keyID, ps.keySecret)
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http request failed: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("razorpay api status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var paymentEntity RazorpayPaymentEntity
	if err := json.Unmarshal(bodyBytes, &paymentEntity); err != nil {
		return nil, fmt.Errorf("failed to unmarshal payment: %w", err)
	}

	return &paymentEntity, nil
}

// CreateRefund issues a full refund for a captured Razorpay payment.
func (ps *PaymentService) CreateRefund(paymentID string) error {
	if paymentID == "" {
		return errors.New("payment id is empty")
	}
	if ps.keyID == "" || ps.keySecret == "" {
		return errors.New("razorpay credentials are not set")
	}

	url := fmt.Sprintf("https://api.razorpay.com/v1/payments/%s/refund", paymentID)
	req, err := http.NewRequest("POST", url, bytes.NewBuffer([]byte("{}")))
	if err != nil {
		return fmt.Errorf("failed to create refund request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.SetBasicAuth(ps.keyID, ps.keySecret)

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("refund http request failed: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read refund response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("razorpay refund failed status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	return nil
}
