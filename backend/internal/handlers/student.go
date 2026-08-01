package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"campusbites/backend/internal/models"
	"math/rand"
)

type RegisterRequest struct {
	MobileNumber string `json:"mobile_number"`
	ShortName    string `json:"short_name"`
	RollNumber   string `json:"roll_number"`
	IDCardURL    string `json:"id_card_url"`
}

type LoginRequest struct {
	MobileNumber string `json:"mobile_number"`
}

type OrderItemRequest struct {
	ProductID string `json:"product_id"`
	Quantity  int    `json:"quantity"`
}

type CreateOrderRequest struct {
	RoomNumber          string             `json:"room_number"`
	Building            string             `json:"building"`
	Floor               int                `json:"floor"`
	SpecialInstructions string             `json:"special_instructions"`
	DeliverySlotID      string             `json:"delivery_slot_id"`
	Items               []OrderItemRequest `json:"items"`
}

type VerifyPaymentRequest struct {
	OrderID           string `json:"order_id"`
	RazorpayOrderID   string `json:"razorpay_order_id"`
	RazorpayPaymentID string `json:"razorpay_payment_id"`
	RazorpaySignature string `json:"razorpay_signature"`
}

// StudentRegister handles registration and calls OCR.
func (h *HandlerContext) StudentRegister(w http.ResponseWriter, r *http.Request) {
	var req RegisterRequest
	if err := jsonNewDecoder(r, &req); err != nil {
		RespondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.MobileNumber == "" || req.ShortName == "" || req.RollNumber == "" || req.IDCardURL == "" {
		RespondError(w, http.StatusBadRequest, "missing required fields")
		return
	}

	ctx := r.Context()

	// 1. Check duplicate roll number or mobile number
	var exists bool
	dupQuery := `SELECT EXISTS(SELECT 1 FROM students WHERE mobile_number = $1 OR roll_number = $2)`
	err := h.DB.Pool.QueryRow(ctx, dupQuery, req.MobileNumber, req.RollNumber).Scan(&exists)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "database error: "+err.Error())
		return
	}
	if exists {
		RespondError(w, http.StatusConflict, "mobile number or roll number already registered")
		return
	}

	// 2. Process OCR verification
	doc, err := h.OCRService.ProcessVerification(req.ShortName, req.RollNumber, req.IDCardURL)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "ocr process failed: "+err.Error())
		return
	}

	// Check if this document hash or roll number is duplicated
	var docExists bool
	docDupQuery := `SELECT EXISTS(SELECT 1 FROM student_documents WHERE ocr_extracted_roll_number = $1)`
	err = h.DB.Pool.QueryRow(ctx, docDupQuery, doc.OCRExtractedRollNumber).Scan(&docExists)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "database error: "+err.Error())
		return
	}
	if docExists {
		doc.DuplicateFlag = true
		doc.ConfidenceLevel = models.ConfidenceLevelLow
	}

	if doc.NameSimilarityScore < 60.0 {
		RespondError(w, http.StatusBadRequest, "Please scan your ID card properly, by cleaning the lens.")
		return
	}

	verificationStatus := models.VerificationStatusVerified

	// 3. Begin Transaction to insert student + document
	tx, err := h.DB.Pool.Begin(ctx)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to start transaction")
		return
	}
	defer tx.Rollback(ctx)

	var studentID string
	insertStudent := `
		INSERT INTO students (mobile_number, short_name, roll_number, verification_status, registered_at)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id
	`
	err = tx.QueryRow(ctx, insertStudent, req.MobileNumber, req.ShortName, req.RollNumber, verificationStatus, time.Now()).Scan(&studentID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to create student profile")
		return
	}

	insertDoc := `
		INSERT INTO student_documents (student_id, id_card_url, ocr_extracted_name, ocr_extracted_roll_number, name_similarity_score, duplicate_flag, confidence_level)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`
	_, err = tx.Exec(ctx, insertDoc, studentID, doc.IDCardURL, doc.OCRExtractedName, doc.OCRExtractedRollNumber, doc.NameSimilarityScore, doc.DuplicateFlag, doc.ConfidenceLevel)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to store verification documents")
		return
	}

	err = tx.Commit(ctx)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to commit transaction")
		return
	}

	// 4. Generate token
	token, err := h.AuthService.GenerateJWT(studentID, "student")
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to generate access token")
		return
	}

	RespondJSON(w, http.StatusCreated, map[string]interface{}{
		"token": token,
		"student": models.Student{
			ID:                 studentID,
			MobileNumber:       req.MobileNumber,
			ShortName:          req.ShortName,
			RollNumber:         req.RollNumber,
			VerificationStatus: verificationStatus,
		},
	})
}

type OCRPreviewRequest struct {
	ShortName  string `json:"short_name"`
	RollNumber string `json:"roll_number"`
	IDCardURL  string `json:"id_card_url"`
}

// StudentOCRPreview runs server-side OCR against an uploaded ID card image (public, used during registration).
func (h *HandlerContext) StudentOCRPreview(w http.ResponseWriter, r *http.Request) {
	var req OCRPreviewRequest
	if err := jsonNewDecoder(r, &req); err != nil {
		RespondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.ShortName == "" || req.RollNumber == "" || req.IDCardURL == "" {
		RespondError(w, http.StatusBadRequest, "short_name, roll_number, and id_card_url are required")
		return
	}

	doc, err := h.OCRService.ProcessVerification(req.ShortName, req.RollNumber, req.IDCardURL)
	if err != nil {
		RespondError(w, http.StatusBadRequest, err.Error())
		return
	}

	RespondJSON(w, http.StatusOK, map[string]interface{}{
		"extracted_name":   doc.OCRExtractedName,
		"extracted_roll":   doc.OCRExtractedRollNumber,
		"similarity_score": doc.NameSimilarityScore,
		"confidence":       doc.ConfidenceLevel,
	})
}

// StudentLogin handles mobile login and returns token + details for returning students.
func (h *HandlerContext) StudentLogin(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := jsonNewDecoder(r, &req); err != nil {
		RespondError(w, http.StatusBadRequest, "invalid request")
		return
	}

	ctx := r.Context()
	var student models.Student
	var lastRoom sql.NullString

	query := `
		SELECT id, mobile_number, short_name, roll_number, last_room_number, verification_status, registered_at
		FROM students
		WHERE mobile_number = $1
	`
	err := h.DB.Pool.QueryRow(ctx, query, req.MobileNumber).Scan(
		&student.ID,
		&student.MobileNumber,
		&student.ShortName,
		&student.RollNumber,
		&lastRoom,
		&student.VerificationStatus,
		&student.RegisteredAt,
	)

	if err != nil {
		RespondError(w, http.StatusNotFound, "student profile not found, please register")
		return
	}

	if lastRoom.Valid {
		student.LastRoomNumber = lastRoom.String
	}

	token, err := h.AuthService.GenerateJWT(student.ID, "student")
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "token creation failed")
		return
	}

	RespondJSON(w, http.StatusOK, map[string]interface{}{
		"token":   token,
		"student": student,
	})
}

// GetMenu fetches the list of categorized products.
func (h *HandlerContext) GetMenu(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Load categories
	catQuery := `SELECT id, name FROM categories`
	catRows, err := h.DB.Pool.Query(ctx, catQuery)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to query categories")
		return
	}
	defer catRows.Close()

	var categories []models.Category
	for catRows.Next() {
		var cat models.Category
		if err := catRows.Scan(&cat.ID, &cat.Name); err == nil {
			categories = append(categories, cat)
		}
	}

	// Load products
	prodQuery := `SELECT id, name, category_id, mrp, selling_price, image_url, is_available FROM products`
	prodRows, err := h.DB.Pool.Query(ctx, prodQuery)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to query products")
		return
	}
	defer prodRows.Close()

	var products []models.Product
	for prodRows.Next() {
		var prod models.Product
		if err := prodRows.Scan(&prod.ID, &prod.Name, &prod.CategoryID, &prod.MRP, &prod.SellingPrice, &prod.ImageURL, &prod.IsAvailable); err == nil {
			products = append(products, prod)
		}
	}

	RespondJSON(w, http.StatusOK, map[string]interface{}{
		"categories": categories,
		"products":   products,
	})
}

func parseTimeStr(tStr string) (int, int, error) {
	tStr = strings.TrimSpace(tStr)
	if strings.Contains(strings.ToUpper(tStr), "AM") || strings.Contains(strings.ToUpper(tStr), "PM") {
		t, err := time.Parse("03:04 PM", strings.ToUpper(tStr))
		if err == nil {
			return t.Hour(), t.Minute(), nil
		}
		t, err = time.Parse("3:04 PM", strings.ToUpper(tStr))
		if err == nil {
			return t.Hour(), t.Minute(), nil
		}
	}
	t, err := time.Parse("15:04", tStr)
	if err == nil {
		return t.Hour(), t.Minute(), nil
	}
	return 0, 0, fmt.Errorf("invalid format")
}

// StudentCreateOrder processes order creation and returns the Razorpay order ID.
func (h *HandlerContext) StudentCreateOrder(w http.ResponseWriter, r *http.Request) {
	studentID := r.Context().Value("user_id").(string)

	// 0. Check order cutoff time limit
	if h.Redis != nil && h.Redis.Client != nil {
		cutoffVal, err := h.Redis.Client.Get(r.Context(), "order_cutoff_time").Result()
		if err == nil && cutoffVal != "" {
			ch, cm, err := parseTimeStr(cutoffVal)
			if err == nil {
				loc, err := time.LoadLocation("Asia/Kolkata")
				var now time.Time
				if err == nil {
					now = time.Now().In(loc)
				} else {
					now = time.Now().UTC().Add(5*time.Hour + 30*time.Minute)
				}

				cutoffTime := time.Date(now.Year(), now.Month(), now.Day(), ch, cm, 0, 0, now.Location())
				if now.After(cutoffTime) {
					RespondError(w, http.StatusForbidden, fmt.Sprintf("Ordering has closed for today at %s", cutoffVal))
					return
				}
			}
		}
	}

	var req CreateOrderRequest
	if err := jsonNewDecoder(r, &req); err != nil {
		RespondError(w, http.StatusBadRequest, "invalid order request")
		return
	}

	if len(req.Items) == 0 {
		RespondError(w, http.StatusBadRequest, "order must contain at least one item")
		return
	}

	if strings.TrimSpace(req.DeliverySlotID) == "" {
		RespondError(w, http.StatusBadRequest, "delivery slot is required")
		return
	}

	ctx := r.Context()

	// Validate selected delivery slot is active and still open today (IST)
	var slotActive bool
	var slotCutoff string
	err := h.DB.Pool.QueryRow(ctx, `
		SELECT is_active, TO_CHAR(order_cutoff, 'HH24:MI')
		FROM delivery_slots WHERE id = $1
	`, req.DeliverySlotID).Scan(&slotActive, &slotCutoff)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "invalid delivery slot")
		return
	}
	if !slotActive {
		RespondError(w, http.StatusBadRequest, "selected delivery slot is disabled")
		return
	}
	if !isSlotOrderingOpen(slotCutoff, istNow()) {
		RespondError(w, http.StatusForbidden, fmt.Sprintf("ordering for this slot closed at %s", slotCutoff))
		return
	}

	// Cancel stale unpaid orders for this student (older than 30 minutes)
	_, _ = h.DB.Pool.Exec(ctx, `
		WITH stale AS (
			SELECT o.id
			FROM orders o
			JOIN payments p ON p.order_id = o.id
			WHERE o.student_id = $1
			  AND o.status = $2
			  AND p.status = $3
			  AND o.created_at < NOW() - INTERVAL '30 minutes'
		),
		cancel_orders AS (
			UPDATE orders SET status = $4 WHERE id IN (SELECT id FROM stale) RETURNING id
		)
		UPDATE payments SET status = $5
		WHERE order_id IN (SELECT id FROM cancel_orders) AND status = $3
	`, studentID, models.OrderStatusReceived, models.PaymentStatusCreated, models.OrderStatusCancelled, models.PaymentStatusFailed)

	// Check if student is blocked
	var status string
	err = h.DB.Pool.QueryRow(ctx, `SELECT verification_status FROM students WHERE id = $1`, studentID).Scan(&status)
	if err != nil || status == models.VerificationStatusRejected {
		RespondError(w, http.StatusForbidden, "your account is blocked by an admin")
		return
	}

	type ProductInfo struct {
		Price float64
		Name  string
	}
	productDetails := make(map[string]ProductInfo)
	var totalAmount float64

	for _, item := range req.Items {
		if item.Quantity <= 0 {
			RespondError(w, http.StatusBadRequest, "quantity must be greater than zero")
			return
		}
		var price float64
		var name string
		var isAvailable bool
		err = h.DB.Pool.QueryRow(ctx, `SELECT name, selling_price, is_available FROM products WHERE id = $1`, item.ProductID).Scan(&name, &price, &isAvailable)
		if err != nil {
			RespondError(w, http.StatusBadRequest, "product not found: "+item.ProductID)
			return
		}
		if !isAvailable {
			RespondError(w, http.StatusBadRequest, "product out of stock: "+name)
			return
		}
		totalAmount += price * float64(item.Quantity)
		productDetails[item.ProductID] = ProductInfo{Price: price, Name: name}
	}

	// Create Razorpay order outside the DB transaction to avoid holding locks during HTTP I/O
	rzpOrderID, err := h.PaymentService.CreateRazorpayOrder(totalAmount)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "razorpay creation failed")
		return
	}

	tx, err := h.DB.Pool.Begin(ctx)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "transaction begin failed")
		return
	}
	defer tx.Rollback(ctx)

	rand.Seed(time.Now().UnixNano())
	orderNum := fmt.Sprintf("CB-%d-%d", time.Now().Unix()%100000, rand.Intn(900)+100)

	var orderID string
	insertOrder := `
		INSERT INTO orders (order_number, student_id, room_number, building, floor, total_amount, status, special_instructions, delivery_slot_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id
	`
	err = tx.QueryRow(ctx, insertOrder, orderNum, studentID, req.RoomNumber, req.Building, req.Floor, totalAmount, models.OrderStatusReceived, req.SpecialInstructions, req.DeliverySlotID).Scan(&orderID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to save order header")
		return
	}

	for _, item := range req.Items {
		insertItem := `
			INSERT INTO order_items (order_id, product_id, quantity, unit_price)
			VALUES ($1, $2, $3, $4)
		`
		_, err = tx.Exec(ctx, insertItem, orderID, item.ProductID, item.Quantity, productDetails[item.ProductID].Price)
		if err != nil {
			RespondError(w, http.StatusInternalServerError, "failed to save items")
			return
		}
	}

	insertHistory := `
		INSERT INTO order_status_history (order_id, status, changed_by, changed_at)
		VALUES ($1, $2, $3, $4)
	`
	_, err = tx.Exec(ctx, insertHistory, orderID, models.OrderStatusReceived, studentID, time.Now())
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to save history")
		return
	}

	insertPayment := `
		INSERT INTO payments (order_id, razorpay_order_id, amount, status)
		VALUES ($1, $2, $3, $4)
	`
	_, err = tx.Exec(ctx, insertPayment, orderID, rzpOrderID, totalAmount, models.PaymentStatusCreated)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to save payment record")
		return
	}

	_, err = tx.Exec(ctx, `UPDATE students SET last_room_number = $1 WHERE id = $2`, req.RoomNumber, studentID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to update room number")
		return
	}

	err = tx.Commit(ctx)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to commit transaction")
		return
	}

	RespondJSON(w, http.StatusCreated, map[string]interface{}{
		"order_id":          orderID,
		"order_number":      orderNum,
		"total_amount":      totalAmount,
		"razorpay_order_id": rzpOrderID,
	})
}

// StudentVerifyPayment checks payment signatures and marks the order as paid.
func (h *HandlerContext) StudentVerifyPayment(w http.ResponseWriter, r *http.Request) {
	studentID := r.Context().Value("user_id").(string)

	var req VerifyPaymentRequest
	if err := jsonNewDecoder(r, &req); err != nil {
		RespondError(w, http.StatusBadRequest, "invalid payment details")
		return
	}

	if req.OrderID == "" || req.RazorpayOrderID == "" || req.RazorpayPaymentID == "" || req.RazorpaySignature == "" {
		RespondError(w, http.StatusBadRequest, "missing required payment verification fields")
		return
	}

	err := h.PaymentService.VerifyPaymentSignature(req.RazorpayOrderID, req.RazorpayPaymentID, req.RazorpaySignature)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "invalid payment signature: "+err.Error())
		return
	}

	ctx := r.Context()

	// Idempotent success if already paid for this student's order
	var currentStatus string
	err = h.DB.Pool.QueryRow(ctx, `
		SELECT p.status
		FROM payments p
		JOIN orders o ON o.id = p.order_id
		WHERE p.order_id = $1 AND p.razorpay_order_id = $2 AND o.student_id = $3
	`, req.OrderID, req.RazorpayOrderID, studentID).Scan(&currentStatus)
	if err != nil {
		RespondError(w, http.StatusNotFound, "payment record not found for this order")
		return
	}
	if currentStatus == models.PaymentStatusPaid {
		RespondJSON(w, http.StatusOK, map[string]string{"message": "payment already verified"})
		return
	}
	if currentStatus != models.PaymentStatusCreated {
		RespondError(w, http.StatusBadRequest, "payment cannot be verified in status: "+currentStatus)
		return
	}

	tx, err := h.DB.Pool.Begin(ctx)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "transaction failed")
		return
	}
	defer tx.Rollback(ctx)

	updatePayment := `
		UPDATE payments p
		SET status = $1, razorpay_payment_id = $2, razorpay_signature = $3
		FROM orders o
		WHERE p.order_id = o.id
		  AND p.order_id = $4
		  AND p.razorpay_order_id = $5
		  AND o.student_id = $6
		  AND p.status = $7
	`
	res, err := tx.Exec(ctx, updatePayment, models.PaymentStatusPaid, req.RazorpayPaymentID, req.RazorpaySignature, req.OrderID, req.RazorpayOrderID, studentID, models.PaymentStatusCreated)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to update payment records")
		return
	}
	if res.RowsAffected() != 1 {
		RespondError(w, http.StatusConflict, "payment was not updated; it may already be processed")
		return
	}

	err = tx.Commit(ctx)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to finalize transaction")
		return
	}

	if h.FCMService != nil {
		var token string
		h.DB.Pool.QueryRow(ctx, "SELECT fcm_token FROM students WHERE id = $1 AND fcm_token IS NOT NULL", studentID).Scan(&token)
		if token != "" {
			_ = h.FCMService.SendToUser(ctx, token, "Order Received!", "Your payment was successful and we are preparing your order.")
		}
	}

	RespondJSON(w, http.StatusOK, map[string]string{"message": "payment verified and order confirmed successfully"})
}

// GetPaymentStatus returns payment/order status for the authenticated student owner.
func (h *HandlerContext) GetPaymentStatus(w http.ResponseWriter, r *http.Request) {
	studentID := r.Context().Value("user_id").(string)
	orderID := getRouteParam(r, "id")
	ctx := r.Context()

	var paymentStatus, orderStatus string
	err := h.DB.Pool.QueryRow(ctx, `
		SELECT p.status, o.status
		FROM orders o
		JOIN payments p ON p.order_id = o.id
		WHERE o.id = $1 AND o.student_id = $2
	`, orderID, studentID).Scan(&paymentStatus, &orderStatus)
	if err != nil {
		RespondError(w, http.StatusNotFound, "order not found")
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{
		"payment_status": paymentStatus,
		"order_status":   orderStatus,
	})
}

// CancelUnpaidOrder cancels an unpaid order owned by the authenticated student.
func (h *HandlerContext) CancelUnpaidOrder(w http.ResponseWriter, r *http.Request) {
	studentID := r.Context().Value("user_id").(string)
	orderID := getRouteParam(r, "id")
	ctx := r.Context()

	tx, err := h.DB.Pool.Begin(ctx)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "transaction failed")
		return
	}
	defer tx.Rollback(ctx)

	var paymentStatus, orderStatus string
	err = tx.QueryRow(ctx, `
		SELECT p.status, o.status
		FROM orders o
		JOIN payments p ON p.order_id = o.id
		WHERE o.id = $1 AND o.student_id = $2
	`, orderID, studentID).Scan(&paymentStatus, &orderStatus)
	if err != nil {
		RespondError(w, http.StatusNotFound, "order not found")
		return
	}

	if paymentStatus != models.PaymentStatusCreated {
		RespondError(w, http.StatusBadRequest, "only unpaid orders can be cancelled by the student")
		return
	}
	if orderStatus == models.OrderStatusCancelled {
		RespondJSON(w, http.StatusOK, map[string]string{"message": "order already cancelled"})
		return
	}
	if orderStatus != models.OrderStatusReceived {
		RespondError(w, http.StatusBadRequest, "order cannot be cancelled in current status")
		return
	}

	_, err = tx.Exec(ctx, `UPDATE payments SET status = $1 WHERE order_id = $2`, models.PaymentStatusFailed, orderID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to update payment")
		return
	}
	_, err = tx.Exec(ctx, `UPDATE orders SET status = $1 WHERE id = $2`, models.OrderStatusCancelled, orderID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to cancel order")
		return
	}
	_, err = tx.Exec(ctx, `INSERT INTO order_status_history (order_id, status, changed_by) VALUES ($1, $2, $3)`, orderID, models.OrderStatusCancelled, studentID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to write status history")
		return
	}

	if err := tx.Commit(ctx); err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to commit cancel")
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{"message": "unpaid order cancelled"})
}

// TrackOrder returns real-time tracking information including floor and partner locations.
func (h *HandlerContext) TrackOrder(w http.ResponseWriter, r *http.Request) {
	orderID := getRouteParam(r, "id")
	studentID := r.Context().Value("user_id").(string)
	ctx := r.Context()

	// Load order, status, building details
	var order models.Order
	var paymentStatus string
	var partnerName sql.NullString
	var partnerPhone sql.NullString
	var partnerBuilding sql.NullString
	var partnerFloor sql.NullInt32
	var notAvailableFlag bool

	query := `
		SELECT o.id, o.order_number, o.room_number, o.building, o.floor, o.status, o.created_at, p.status, dp.name, dp.mobile_number, dp.current_building, dp.current_floor, COALESCE(da.not_available_flag, false)
		FROM orders o
		JOIN payments p ON o.id = p.order_id
		LEFT JOIN delivery_assignments da ON o.id = da.order_id
		LEFT JOIN delivery_partners dp ON da.delivery_partner_id = dp.id
		WHERE o.id = $1 AND o.student_id = $2
	`
	err := h.DB.Pool.QueryRow(ctx, query, orderID, studentID).Scan(
		&order.ID,
		&order.OrderNumber,
		&order.RoomNumber,
		&order.Building,
		&order.Floor,
		&order.Status,
		&order.CreatedAt,
		&paymentStatus,
		&partnerName,
		&partnerPhone,
		&partnerBuilding,
		&partnerFloor,
		&notAvailableFlag,
	)

	if err != nil {
		RespondError(w, http.StatusNotFound, "order not found")
		return
	}

	// Load status history timeline
	histQuery := `SELECT status, changed_at FROM order_status_history WHERE order_id = $1 ORDER BY changed_at ASC`
	rows, err := h.DB.Pool.Query(ctx, histQuery, orderID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to fetch order history logs")
		return
	}
	defer rows.Close()

	type HistoryNode struct {
		Status    string    `json:"status"`
		Timestamp time.Time `json:"timestamp"`
	}
	var history []HistoryNode
	for rows.Next() {
		var node HistoryNode
		if err := rows.Scan(&node.Status, &node.Timestamp); err == nil {
			history = append(history, node)
		}
	}

	// Determine queue status details
	var queuePosition int = 0
	var etaMinutes int = 15

	if order.Status == models.OrderStatusAssigned || order.Status == models.OrderStatusOutForDelivery {
		// Calculate how many pending orders are assigned to the same partner that were created before this order
		if partnerName.Valid {
			queueQuery := `
				SELECT COUNT(*) 
				FROM orders o
				JOIN delivery_assignments da ON o.id = da.order_id
				JOIN delivery_partners dp ON da.delivery_partner_id = dp.id
				WHERE dp.name = $1 AND o.status IN ('assigned', 'out_for_delivery') AND o.created_at < $2
			`
			_ = h.DB.Pool.QueryRow(ctx, queueQuery, partnerName.String, order.CreatedAt).Scan(&queuePosition)
			queuePosition += 1 // Position 1 means next stop
			etaMinutes = queuePosition * 5
		}
	}

	// Custom Delivery partner details
	var deliveryPartner interface{} = nil
	if partnerName.Valid {
		deliveryPartner = map[string]interface{}{
			"name":             partnerName.String,
			"phone":            partnerPhone.String,
			"current_building": partnerBuilding.String,
			"current_floor":    partnerFloor.Int32,
		}
	}

	RespondJSON(w, http.StatusOK, map[string]interface{}{
		"order":              order,
		"payment_status":     paymentStatus,
		"delivery_partner":   deliveryPartner,
		"history":            history,
		"queue_position":     queuePosition,
		"eta_minutes":        etaMinutes,
		"not_available_flag": notAvailableFlag,
	})
}

// StudentGetHistory lists all previous orders.
func (h *HandlerContext) StudentGetHistory(w http.ResponseWriter, r *http.Request) {
	studentID := r.Context().Value("user_id").(string)
	ctx := r.Context()

	query := `
		SELECT o.id, o.order_number, o.room_number, o.building, o.floor, o.total_amount, o.status, o.created_at, p.status
		FROM orders o
		JOIN payments p ON o.id = p.order_id
		WHERE o.student_id = $1
		ORDER BY o.created_at DESC
	`
	rows, err := h.DB.Pool.Query(ctx, query, studentID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to query order history: "+err.Error())
		return
	}
	defer rows.Close()

	type OrderNode struct {
		ID            string    `json:"id"`
		OrderNumber   string    `json:"order_number"`
		RoomNumber    string    `json:"room_number"`
		Building      string    `json:"building"`
		Floor         int       `json:"floor"`
		TotalAmount   float64   `json:"total_amount"`
		Status        string    `json:"status"`
		CreatedAt     time.Time `json:"created_at"`
		PaymentStatus string    `json:"payment_status"`
	}

	var list []OrderNode
	for rows.Next() {
		var o OrderNode
		err = rows.Scan(
			&o.ID,
			&o.OrderNumber,
			&o.RoomNumber,
			&o.Building,
			&o.Floor,
			&o.TotalAmount,
			&o.Status,
			&o.CreatedAt,
			&o.PaymentStatus,
		)
		if err == nil {
			list = append(list, o)
		}
	}

	RespondJSON(w, http.StatusOK, list)
}

type FCMTokenRequest struct {
	Token string `json:"token"`
}

// SaveStudentFCMToken handles saving the FCM token for the student
func (h *HandlerContext) SaveStudentFCMToken(w http.ResponseWriter, r *http.Request) {
	studentID := r.Context().Value("user_id").(string)
	
	var req FCMTokenRequest
	if err := jsonNewDecoder(r, &req); err != nil {
		RespondError(w, http.StatusBadRequest, "invalid payload")
		return
	}

	if req.Token == "" {
		RespondError(w, http.StatusBadRequest, "token is required")
		return
	}

	_, err := h.DB.Pool.Exec(r.Context(), "UPDATE students SET fcm_token = $1 WHERE id = $2", req.Token, studentID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to update fcm token")
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{"message": "token saved successfully"})
}

// GetPrivacyStatus returns whether the student has accepted the privacy policy
func (h *HandlerContext) GetPrivacyStatus(w http.ResponseWriter, r *http.Request) {
	studentID := r.Context().Value("user_id").(string)

	var accepted bool
	err := h.DB.Pool.QueryRow(r.Context(),
		"SELECT COALESCE(privacy_accepted, false) FROM students WHERE id = $1", studentID).Scan(&accepted)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to fetch privacy status")
		return
	}

	RespondJSON(w, http.StatusOK, map[string]bool{"accepted": accepted})
}

// AcceptPrivacy marks the student as having accepted the privacy policy
func (h *HandlerContext) AcceptPrivacy(w http.ResponseWriter, r *http.Request) {
	studentID := r.Context().Value("user_id").(string)

	_, err := h.DB.Pool.Exec(r.Context(),
		"UPDATE students SET privacy_accepted = true, privacy_accepted_at = NOW() WHERE id = $1", studentID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to accept privacy policy")
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{"message": "privacy policy accepted"})
}

// Helper to decode JSON bodies
func jsonNewDecoder(r *http.Request, v interface{}) error {
	return json.NewDecoder(r.Body).Decode(v)
}
