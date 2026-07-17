package models

import (
	"time"
)

// Verification status types
const (
	VerificationStatusPending  = "pending"
	VerificationStatusVerified = "verified"
	VerificationStatusRejected = "rejected"
)

// Confidence level types
const (
	ConfidenceLevelHigh   = "high"
	ConfidenceLevelMedium = "medium"
	ConfidenceLevelLow    = "low"
)

// Order status types
const (
	OrderStatusReceived       = "received"
	OrderStatusPreparing      = "preparing"
	OrderStatusPacked         = "packed"
	OrderStatusAssigned       = "assigned"
	OrderStatusOutForDelivery = "out_for_delivery"
	OrderStatusDelivered      = "delivered"
	OrderStatusCancelled      = "cancelled"
)

// Payment status types
const (
	PaymentStatusCreated  = "created"
	PaymentStatusPaid     = "paid"
	PaymentStatusFailed   = "failed"
	PaymentStatusRefunded = "refunded"
)

// Admin role types
const (
	AdminRoleSuperAdmin = "super_admin"
	AdminRoleStaff      = "staff"
)

// Student model mapping to students table
type Student struct {
	ID                 string    `json:"id"`
	MobileNumber       string    `json:"mobile_number"`
	ShortName          string    `json:"short_name"`
	RollNumber         string    `json:"roll_number"`
	LastRoomNumber     string    `json:"last_room_number,omitempty"`
	VerificationStatus string    `json:"verification_status"`
	RegisteredAt       time.Time `json:"registered_at"`
}

// StudentDocument model mapping to student_documents table
type StudentDocument struct {
	ID                     string  `json:"id"`
	StudentID              string  `json:"student_id"`
	IDCardURL              string  `json:"id_card_url"`
	OCRExtractedName       string  `json:"ocr_extracted_name"`
	OCRExtractedRollNumber string  `json:"ocr_extracted_roll_number"`
	NameSimilarityScore    float64 `json:"name_similarity_score"`
	DuplicateFlag          bool    `json:"duplicate_flag"`
	ConfidenceLevel        string  `json:"confidence_level"`
}

// Category model mapping to categories table
type Category struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// Product model mapping to products table
type Product struct {
	ID           string  `json:"id"`
	Name         string  `json:"name"`
	CategoryID   string  `json:"category_id"`
	MRP          float64 `json:"mrp"`
	SellingPrice float64 `json:"selling_price"`
	ImageURL     string  `json:"image_url"`
	IsAvailable  bool    `json:"is_available"`
}

// Order model mapping to orders table
type Order struct {
	ID                  string      `json:"id"`
	OrderNumber         string      `json:"order_number"`
	StudentID           string      `json:"student_id"`
	RoomNumber          string      `json:"room_number"`
	Building            string      `json:"building"`
	Floor               int         `json:"floor"`
	TotalAmount         float64     `json:"total_amount"`
	Status              string      `json:"status"`
	SpecialInstructions string      `json:"special_instructions,omitempty"`
	CreatedAt           time.Time   `json:"created_at"`
	Items               []OrderItem `json:"items,omitempty"`
}

// OrderItem model mapping to order_items table
type OrderItem struct {
	ID          string  `json:"id"`
	OrderID     string  `json:"order_id,omitempty"`
	ProductID   string  `json:"product_id"`
	ProductName string  `json:"product_name,omitempty"`
	Quantity    int     `json:"quantity"`
	UnitPrice   float64 `json:"unit_price"`
}

// Payment model mapping to payments table
type Payment struct {
	ID                string    `json:"id"`
	OrderID           string    `json:"order_id"`
	RazorpayOrderID   string    `json:"razorpay_order_id,omitempty"`   // Hide if empty/admin context
	RazorpayPaymentID string    `json:"razorpay_payment_id,omitempty"` // Hide if empty/admin context
	RazorpaySignature string    `json:"razorpay_signature,omitempty"`  // Hide if empty/admin context
	Amount            float64   `json:"amount"`
	Status            string    `json:"status"`
	WebhookLog        string    `json:"webhook_log,omitempty"` // Raw JSON string
	CreatedAt         time.Time `json:"created_at"`
}

// DeliveryPartner model mapping to delivery_partners table
type DeliveryPartner struct {
	ID              string `json:"id"`
	Name            string `json:"name"`
	MobileNumber    string `json:"mobile_number"`
	PasswordHash    string `json:"-"` // Never serialize passwords
	IsOnline        bool   `json:"is_online"`
	CurrentBuilding string `json:"current_building,omitempty"`
	CurrentFloor    int    `json:"current_floor,omitempty"`
}

// DeliveryAssignment model mapping to delivery_assignments table
type DeliveryAssignment struct {
	ID                string     `json:"id"`
	OrderID           string     `json:"order_id"`
	DeliveryPartnerID string     `json:"delivery_partner_id"`
	AssignedAt        time.Time  `json:"assigned_at"`
	DeliveredAt       *time.Time `json:"delivered_at,omitempty"`
	NotAvailableFlag  bool       `json:"not_available_flag"`
	DeliveryNotes     string     `json:"delivery_notes,omitempty"`
}

// OrderStatusHistory model mapping to order_status_history table
type OrderStatusHistory struct {
	ID        string    `json:"id"`
	OrderID   string    `json:"order_id"`
	Status    string    `json:"status"`
	ChangedBy string    `json:"changed_by"`
	ChangedAt time.Time `json:"changed_at"`
}

// AdminUser model mapping to admin_users table
type AdminUser struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"` // Never serialize passwords
	Role         string    `json:"role"`
	CreatedAt    time.Time `json:"created_at"`
}

// AuditLog model mapping to audit_logs table
type AuditLog struct {
	ID        string    `json:"id"`
	ActorID   string    `json:"actor_id"`
	ActorRole string    `json:"actor_role"`
	Action    string    `json:"action"`
	IPAddress string    `json:"ip_address"`
	UserAgent string    `json:"user_agent"`
	CreatedAt time.Time `json:"created_at"`
}

// SECURE DATA SEGREGATION VIEW
// DeliveryOrderView enforces field-level data protection.
// Excludes: id_card_url, OCR extraction fields, raw Razorpay signatures/ids.
// Exposes: Only delivery-related info + simple payment status ("Paid" or "Unpaid").
type DeliveryOrderView struct {
	ID                  string      `json:"id"`
	OrderNumber         string      `json:"order_number"`
	StudentName         string      `json:"student_name"`
	StudentPhone        string      `json:"student_phone"`
	RoomNumber          string      `json:"room_number"`
	Building            string      `json:"building"`
	Floor               int         `json:"floor"`
	TotalAmount         float64     `json:"total_amount"`
	Status              string      `json:"status"`
	SpecialInstructions string      `json:"special_instructions,omitempty"`
	Items               []OrderItem `json:"items"`
	PaymentStatus       string      `json:"payment_status"` // "Paid" or "Unpaid" only
	AssignedAt          time.Time   `json:"assigned_at"`
	DeliveredAt         *time.Time  `json:"delivered_at,omitempty"`
	NotAvailableFlag    bool        `json:"not_available_flag"`
	DeliveryNotes       string      `json:"delivery_notes,omitempty"`
}
