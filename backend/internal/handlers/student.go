package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"campusbites/backend/internal/models"
	"math/rand"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
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
	PrintJobs           []PrintJobRequest  `json:"print_jobs"`
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
	var existingID string
	var existingStatus string
	dupQuery := `SELECT id, verification_status::text FROM students WHERE mobile_number = $1 OR roll_number = $2`
	err := h.DB.Pool.QueryRow(ctx, dupQuery, req.MobileNumber, req.RollNumber).Scan(&existingID, &existingStatus)
	if err == nil {
		if existingStatus == string(models.VerificationStatusVerified) {
			RespondError(w, http.StatusConflict, "mobile number or roll number already registered and verified")
			return
		}
		// Allow re-registration by deleting the unverified record
		_, delErr := h.DB.Pool.Exec(ctx, "DELETE FROM students WHERE id = $1", existingID)
		if delErr != nil {
			RespondError(w, http.StatusInternalServerError, "failed to cleanup previous unverified registration")
			return
		}
	} else if err != pgx.ErrNoRows {
		RespondError(w, http.StatusInternalServerError, "database error: "+err.Error())
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

	verificationStatus := string(models.VerificationStatusVerified)

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
		SELECT id, mobile_number, short_name, roll_number, last_room_number, verification_status::text, registered_at
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
		if err != pgx.ErrNoRows {
			fmt.Printf("Error querying student login: %v\n", err)
		}
		RespondError(w, http.StatusNotFound, "student profile not found, please register")
		return
	}


	if student.VerificationStatus != string(models.VerificationStatusVerified) {
		RespondError(w, http.StatusNotFound, "student profile found but not verified, please complete registration")
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
				if now.After(cutoffTime) || cutoffVal == "00:01" || cutoffVal == "0:01" {
					if cutoffVal == "00:01" || cutoffVal == "0:01" {
						RespondError(w, http.StatusForbidden, "🚀 Something BIG is Cooking!\nWe're taking a short break today to bring you something even better.\nCampusBites will be back tomorrow! ❤️\n\nStay tuned — we've got something special coming your way. 🔥")
					} else {
						RespondError(w, http.StatusForbidden, "🌙 Ordering is closed right now! All delivery slots for today have passed their cutoff time. Please check back tomorrow morning.")
					}
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

	if len(req.Items) == 0 && len(req.PrintJobs) == 0 {
		RespondError(w, http.StatusBadRequest, "order must contain at least one food item or print job")
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
	if !isSlotOrderingOpen(slotCutoff, istNow()) || slotCutoff == "00:01" || slotCutoff == "0:01" {
		if slotCutoff == "00:01" || slotCutoff == "0:01" {
			RespondError(w, http.StatusForbidden, "🚀 Something BIG is Cooking!\nWe're taking a short break today to bring you something even better.\nCampusBites will be back tomorrow! ❤️\n\nStay tuned — we've got something special coming your way. 🔥")
		} else {
			RespondError(w, http.StatusForbidden, "🌙 Ordering is closed right now! All delivery slots for today have passed their cutoff time. Please check back tomorrow morning.")
		}
		return
	}

	// Stale unpaid order reconciliation is safely handled asynchronously by PaymentReconciler worker

	// Check if student is blocked
	var status string
	err = h.DB.Pool.QueryRow(ctx, `SELECT verification_status FROM students WHERE id = $1`, studentID).Scan(&status)
	if err != nil {
		fmt.Printf("Error fetching student verification status: %v\n", err)
		RespondError(w, http.StatusUnauthorized, "Account not found or session expired. Please log in again.")
		return
	}
	if status == models.VerificationStatusRejected {
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

	type computedPrintJob struct {
		req       PrintJobRequest
		unitPrice float64
		lineTotal float64
	}
	computedPrintJobs := make([]computedPrintJob, 0, len(req.PrintJobs))
	if len(req.PrintJobs) > 0 {
		pricing, pricingErr := h.loadPrintPricing(ctx)
		if pricingErr != nil {
			RespondError(w, http.StatusInternalServerError, "print pricing not configured")
			return
		}
		for i, job := range req.PrintJobs {
			job.ColorMode = strings.ToLower(strings.TrimSpace(job.ColorMode))
			job.Sides = strings.ToLower(strings.TrimSpace(job.Sides))
			job.FileType = strings.ToLower(strings.TrimSpace(job.FileType))
			if err := validatePrintJobRequest(job); err != nil {
				RespondError(w, http.StatusBadRequest, fmt.Sprintf("print job %d: %s", i+1, err.Error()))
				return
			}
			unitPrice, rateErr := rateForPrintJob(pricing, job.ColorMode, job.Sides)
			if rateErr != nil {
				RespondError(w, http.StatusBadRequest, fmt.Sprintf("print job %d: %s", i+1, rateErr.Error()))
				return
			}
			units := billablePrintUnits(job.PageCount, job.Sides)
			lineTotal := unitPrice * float64(units) * float64(job.Copies)
			totalAmount += lineTotal
			computedPrintJobs = append(computedPrintJobs, computedPrintJob{req: job, unitPrice: unitPrice, lineTotal: lineTotal})
		}
	}

	if totalAmount <= 0 {
		RespondError(w, http.StatusBadRequest, "order total must be greater than zero")
		return
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

	var slotIDParam interface{} = nil
	if strings.TrimSpace(req.DeliverySlotID) != "" {
		slotIDParam = strings.TrimSpace(req.DeliverySlotID)
	}

	var orderID string
	insertOrder := `
		INSERT INTO orders (order_number, student_id, room_number, building, floor, total_amount, status, special_instructions, delivery_slot_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id
	`
	err = tx.QueryRow(ctx, insertOrder, orderNum, studentID, req.RoomNumber, req.Building, req.Floor, totalAmount, models.OrderStatusReceived, req.SpecialInstructions, slotIDParam).Scan(&orderID)
	if err != nil {
		fmt.Printf("Order creation failed (save order header): %v\n", err)
		RespondError(w, http.StatusInternalServerError, fmt.Sprintf("failed to save order header: %v", err))
		return
	}

	for _, item := range req.Items {
		insertItem := `
			INSERT INTO order_items (order_id, product_id, quantity, unit_price)
			VALUES ($1, $2, $3, $4)
		`
		_, err = tx.Exec(ctx, insertItem, orderID, item.ProductID, item.Quantity, productDetails[item.ProductID].Price)
		if err != nil {
			fmt.Printf("Order creation failed (save item %s): %v\n", item.ProductID, err)
			RespondError(w, http.StatusInternalServerError, fmt.Sprintf("failed to save items: %v", err))
			return
		}
	}

	for _, job := range computedPrintJobs {
		_, err = tx.Exec(ctx, `
			INSERT INTO print_jobs (
				order_id, file_url, file_name, file_type, color_mode, sides,
				page_count, copies, unit_price, line_total
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		`, orderID, job.req.FileURL, job.req.FileName, job.req.FileType, job.req.ColorMode, job.req.Sides,
			job.req.PageCount, job.req.Copies, job.unitPrice, job.lineTotal)
		if err != nil {
			fmt.Printf("Order creation failed (save print job): %v\n", err)
			RespondError(w, http.StatusInternalServerError, fmt.Sprintf("failed to save print jobs: %v", err))
			return
		}
	}

	insertHistory := `
		INSERT INTO order_status_history (order_id, status, changed_by, changed_at)
		VALUES ($1, $2, $3, $4)
	`
	_, err = tx.Exec(ctx, insertHistory, orderID, models.OrderStatusReceived, studentID, time.Now())
	if err != nil {
		fmt.Printf("Order creation failed (save history): %v\n", err)
		RespondError(w, http.StatusInternalServerError, fmt.Sprintf("failed to save history: %v", err))
		return
	}

	insertPayment := `
		INSERT INTO payments (order_id, razorpay_order_id, amount, status)
		VALUES ($1, $2, $3, $4)
	`
	_, err = tx.Exec(ctx, insertPayment, orderID, rzpOrderID, totalAmount, models.PaymentStatusCreated)
	if err != nil {
		fmt.Printf("Order creation failed (save payment record): %v\n", err)
		RespondError(w, http.StatusInternalServerError, fmt.Sprintf("failed to save payment record: %v", err))
		return
	}

	_, err = tx.Exec(ctx, `UPDATE students SET last_room_number = $1 WHERE id = $2`, req.RoomNumber, studentID)
	if err != nil {
		fmt.Printf("Order creation failed (update room number): %v\n", err)
		RespondError(w, http.StatusInternalServerError, fmt.Sprintf("failed to update room number: %v", err))
		return
	}

	// Empty student's cart in DB upon order creation
	_, _ = tx.Exec(ctx, `DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE student_id = $1)`, studentID)

	err = tx.Commit(ctx)
	if err != nil {
		fmt.Printf("Order creation failed (commit tx): %v\n", err)
		RespondError(w, http.StatusInternalServerError, fmt.Sprintf("failed to commit transaction: %v", err))
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

	// Call central, thread-safe, idempotent ConfirmPaymentAndOrder
	err = h.ConfirmPaymentAndOrder(ctx, req.RazorpayOrderID, req.RazorpayPaymentID, req.RazorpaySignature, "frontend_callback", 0, "INR", "")
	if err != nil {
		RespondError(w, http.StatusBadRequest, "payment verification failed: "+err.Error())
		return
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
		SELECT o.id, o.order_number, o.room_number, o.building, o.floor, o.total_amount, o.status, o.created_at, p.status, COALESCE(da.not_available_flag, false)
		FROM orders o
		JOIN payments p ON o.id = p.order_id
		LEFT JOIN delivery_assignments da ON o.id = da.order_id
		WHERE o.student_id = $1 AND p.status IN ('paid', 'reconciliation_required')
		ORDER BY o.created_at DESC
	`
	rows, err := h.DB.Pool.Query(ctx, query, studentID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to query order history: "+err.Error())
		return
	}
	defer rows.Close()

	type OrderNode struct {
		ID               string    `json:"id"`
		OrderNumber      string    `json:"order_number"`
		RoomNumber       string    `json:"room_number"`
		Building         string    `json:"building"`
		Floor            int       `json:"floor"`
		TotalAmount      float64   `json:"total_amount"`
		Status           string    `json:"status"`
		CreatedAt        time.Time `json:"created_at"`
		PaymentStatus    string    `json:"payment_status"`
		NotAvailableFlag bool      `json:"not_available_flag"`
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
			&o.NotAvailableFlag,
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

// GetCart returns the authenticated student's stored cart items
func (h *HandlerContext) GetCart(w http.ResponseWriter, r *http.Request) {
	studentID, ok := r.Context().Value("user_id").(string)
	if !ok || studentID == "" {
		RespondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	ctx := r.Context()
	var cartID string
	err := h.DB.Pool.QueryRow(ctx, "SELECT id FROM carts WHERE student_id = $1", studentID).Scan(&cartID)
	if err != nil {
		RespondJSON(w, http.StatusOK, map[string]interface{}{"items": []models.CartItemData{}})
		return
	}

	rows, err := h.DB.Pool.Query(ctx, "SELECT product_id, quantity FROM cart_items WHERE cart_id = $1", cartID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to query cart items")
		return
	}
	defer rows.Close()

	var items []models.CartItemData
	for rows.Next() {
		var item models.CartItemData
		if err := rows.Scan(&item.ProductID, &item.Quantity); err == nil {
			items = append(items, item)
		}
	}

	RespondJSON(w, http.StatusOK, map[string]interface{}{"items": items})
}

// UpdateCart replaces the student's stored cart with the provided items
func (h *HandlerContext) UpdateCart(w http.ResponseWriter, r *http.Request) {
	studentID, ok := r.Context().Value("user_id").(string)
	if !ok || studentID == "" {
		RespondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req struct {
		Items []models.CartItemData `json:"items"`
	}
	if err := jsonNewDecoder(r, &req); err != nil {
		RespondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	ctx := r.Context()
	tx, err := h.DB.Pool.Begin(ctx)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to begin transaction")
		return
	}
	defer tx.Rollback(ctx)

	var cartID string
	err = tx.QueryRow(ctx, `
		INSERT INTO carts (student_id, updated_at) VALUES ($1, NOW())
		ON CONFLICT (student_id) DO UPDATE SET updated_at = NOW()
		RETURNING id
	`, studentID).Scan(&cartID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to upsert cart")
		return
	}

	_, err = tx.Exec(ctx, "DELETE FROM cart_items WHERE cart_id = $1", cartID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to clear existing items")
		return
	}

	for _, item := range req.Items {
		if item.Quantity > 0 && item.ProductID != "" {
			_, _ = tx.Exec(ctx, `
				INSERT INTO cart_items (cart_id, product_id, quantity)
				VALUES ($1, $2, $3)
			`, cartID, item.ProductID, item.Quantity)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to commit transaction")
		return
	}

	RespondJSON(w, http.StatusOK, map[string]interface{}{"status": "success", "items": req.Items})
}

// MergeCart merges a guest user's cart into the authenticated student's cart on login
func (h *HandlerContext) MergeCart(w http.ResponseWriter, r *http.Request) {
	studentID, ok := r.Context().Value("user_id").(string)
	if !ok || studentID == "" {
		RespondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req struct {
		Items []models.CartItemData `json:"items"`
	}
	if err := jsonNewDecoder(r, &req); err != nil {
		RespondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	ctx := r.Context()
	tx, err := h.DB.Pool.Begin(ctx)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to begin transaction")
		return
	}
	defer tx.Rollback(ctx)

	var cartID string
	err = tx.QueryRow(ctx, `
		INSERT INTO carts (student_id, updated_at) VALUES ($1, NOW())
		ON CONFLICT (student_id) DO UPDATE SET updated_at = NOW()
		RETURNING id
	`, studentID).Scan(&cartID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to upsert cart")
		return
	}

	for _, guestItem := range req.Items {
		if guestItem.Quantity > 0 && guestItem.ProductID != "" {
			_, _ = tx.Exec(ctx, `
				INSERT INTO cart_items (cart_id, product_id, quantity)
				VALUES ($1, $2, $3)
				ON CONFLICT (cart_id, product_id)
				DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity
			`, cartID, guestItem.ProductID, guestItem.Quantity)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to commit cart merge")
		return
	}

	rows, err := h.DB.Pool.Query(ctx, "SELECT product_id, quantity FROM cart_items WHERE cart_id = $1", cartID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to fetch merged cart")
		return
	}
	defer rows.Close()

	var mergedItems []models.CartItemData
	for rows.Next() {
		var item models.CartItemData
		if err := rows.Scan(&item.ProductID, &item.Quantity); err == nil {
			mergedItems = append(mergedItems, item)
		}
	}

	RespondJSON(w, http.StatusOK, map[string]interface{}{"status": "merged", "items": mergedItems})
}

// CreateOrderReview stores rating and text review for a student's delivered order
func (h *HandlerContext) CreateOrderReview(w http.ResponseWriter, r *http.Request) {
	studentID, ok := r.Context().Value("user_id").(string)
	if !ok || studentID == "" {
		RespondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	orderID := chi.URLParam(r, "id")
	if orderID == "" {
		RespondError(w, http.StatusBadRequest, "order_id is required")
		return
	}

	var req struct {
		Rating int    `json:"rating"`
		Review string `json:"review"`
	}
	if err := jsonNewDecoder(r, &req); err != nil {
		RespondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Rating < 1 || req.Rating > 5 {
		RespondError(w, http.StatusBadRequest, "rating must be between 1 and 5 stars")
		return
	}

	ctx := r.Context()
	var exists bool
	err := h.DB.Pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM orders WHERE id = $1 AND student_id = $2)", orderID, studentID).Scan(&exists)
	if err != nil || !exists {
		RespondError(w, http.StatusForbidden, "order not found or does not belong to you")
		return
	}

	_, err = h.DB.Pool.Exec(ctx, `
		INSERT INTO order_reviews (order_id, student_id, rating, review, created_at)
		VALUES ($1, $2, $3, $4, NOW())
		ON CONFLICT (order_id)
		DO UPDATE SET rating = EXCLUDED.rating, review = EXCLUDED.review, created_at = NOW()
	`, orderID, studentID, req.Rating, req.Review)

	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to store order review")
		return
	}

	RespondJSON(w, http.StatusOK, map[string]interface{}{"status": "success", "message": "Review submitted successfully"})
}

func (h *HandlerContext) ensureMenuScheduleTables(ctx context.Context) {
	createTablesSQL := `
		CREATE TABLE IF NOT EXISTS menu_schedules (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			name VARCHAR(100) NOT NULL,
			start_time TIME NOT NULL,
			end_time TIME NOT NULL,
			is_enabled BOOLEAN DEFAULT TRUE,
			display_order INT DEFAULT 0,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
		);

		CREATE TABLE IF NOT EXISTS menu_schedule_categories (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			schedule_id UUID NOT NULL REFERENCES menu_schedules(id) ON DELETE CASCADE,
			category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
			display_order INT DEFAULT 0,
			CONSTRAINT unique_schedule_category UNIQUE (schedule_id, category_id)
		);
	`
	_, _ = h.DB.Pool.Exec(ctx, createTablesSQL)
}

// GetActiveMenuSchedules returns enabled menu schedules for student menu display
func (h *HandlerContext) GetActiveMenuSchedules(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	h.ensureMenuScheduleTables(ctx)

	query := `
		SELECT ms.id, ms.name, TO_CHAR(ms.start_time, 'HH24:MI'), TO_CHAR(ms.end_time, 'HH24:MI'), ms.is_enabled, ms.display_order
		FROM menu_schedules ms
		WHERE ms.is_enabled = TRUE
		ORDER BY ms.display_order ASC, ms.start_time ASC
	`
	rows, err := h.DB.Pool.Query(ctx, query)
	if err != nil {
		RespondJSON(w, http.StatusOK, []models.MenuSchedule{})
		return
	}
	defer rows.Close()

	var schedules []models.MenuSchedule
	for rows.Next() {
		var s models.MenuSchedule
		if err := rows.Scan(&s.ID, &s.Name, &s.StartTime, &s.EndTime, &s.IsEnabled, &s.DisplayOrder); err == nil {
			s.Categories = h.getMenuScheduleCategories(ctx, s.ID)
			schedules = append(schedules, s)
		}
	}

	if schedules == nil {
		schedules = []models.MenuSchedule{}
	}

	RespondJSON(w, http.StatusOK, schedules)
}

// Helper to decode JSON bodies
func jsonNewDecoder(r *http.Request, v interface{}) error {
	return json.NewDecoder(r.Body).Decode(v)
}
