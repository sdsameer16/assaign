package handlers

import (
	"database/sql"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"campusbites/backend/internal/models"
)

type AdminLoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type CreateProductRequest struct {
	Name         string  `json:"name"`
	CategoryID   string  `json:"category_id"`
	MRP          float64 `json:"mrp"`
	SellingPrice float64 `json:"selling_price"`
	ImageURL     string  `json:"image_url"`
}

type AssignPartnerRequest struct {
	DeliveryPartnerID string `json:"delivery_partner_id"`
}

type CreatePartnerRequest struct {
	Name         string `json:"name"`
	MobileNumber string `json:"mobile_number"`
	Password     string `json:"password"`
}

type UpdateStudentVerificationRequest struct {
	Status string `json:"status"` // 'verified' or 'rejected'
}

// AdminLogin authenticates administration accounts.
func (h *HandlerContext) AdminLogin(w http.ResponseWriter, r *http.Request) {
	var req AdminLoginRequest
	if err := jsonNewDecoder(r, &req); err != nil {
		RespondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	ctx := r.Context()
	var id, name, passHash, role string

	query := `SELECT id, name, password_hash, role FROM admin_users WHERE email = $1`
	err := h.DB.Pool.QueryRow(ctx, query, req.Email).Scan(&id, &name, &passHash, &role)
	if err != nil {
		RespondError(w, http.StatusUnauthorized, "invalid email or password")
		return
	}

	match, err := h.AuthService.VerifyPassword(req.Password, passHash)
	if err != nil || !match {
		RespondError(w, http.StatusUnauthorized, "invalid email or password")
		return
	}

	token, err := h.AuthService.GenerateJWT(id, "admin")
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to generate access token")
		return
	}

	_ = h.AuditService.LogAction(ctx, id, "admin", "Admin login successful", r)

	RespondJSON(w, http.StatusOK, map[string]interface{}{
		"token": token,
		"admin": map[string]string{
			"id":    id,
			"name":  name,
			"email": req.Email,
			"role":  role,
		},
	})
}

// GetDashboardSummary aggregates business statistics for the admin dashboard dashboard.
func (h *HandlerContext) GetDashboardSummary(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var totalRevenue float64
	var totalOrders int
	var avgOrderValue float64
	var verifiedStudents int
	var onlinePartners int

	// 1. Revenue & Orders Summary (completed or out_for_delivery orders)
	revQuery := `
		SELECT COALESCE(SUM(total_amount), 0), COUNT(id) 
		FROM orders 
		WHERE status IN ('delivered', 'assigned', 'out_for_delivery', 'preparing', 'packed')
	`
	_ = h.DB.Pool.QueryRow(ctx, revQuery).Scan(&totalRevenue, &totalOrders)

	if totalOrders > 0 {
		avgOrderValue = totalRevenue / float64(totalOrders)
	}

	// 2. Verified Students count
	_ = h.DB.Pool.QueryRow(ctx, `SELECT COUNT(id) FROM students WHERE verification_status = 'verified'`).Scan(&verifiedStudents)

	// 3. Online delivery partners
	_ = h.DB.Pool.QueryRow(ctx, `SELECT COUNT(id) FROM delivery_partners WHERE is_online = true`).Scan(&onlinePartners)

	// 4. Most popular product name
	var popularProduct string
	popQuery := `
		SELECT p.name 
		FROM order_items oi
		JOIN products p ON oi.product_id = p.id
		GROUP BY p.name
		ORDER BY SUM(oi.quantity) DESC
		LIMIT 1
	`
	_ = h.DB.Pool.QueryRow(ctx, popQuery).Scan(&popularProduct)
	if popularProduct == "" {
		popularProduct = "None yet"
	}

	RespondJSON(w, http.StatusOK, map[string]interface{}{
		"total_revenue":     totalRevenue,
		"total_orders":      totalOrders,
		"avg_order_value":   avgOrderValue,
		"verified_students": verifiedStudents,
		"online_partners":   onlinePartners,
		"popular_product":   popularProduct,
	})
}

// CRUD Products
func (h *HandlerContext) ListProducts(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	query := `
		SELECT p.id, p.name, p.category_id, c.name, p.mrp, p.selling_price, p.image_url, p.is_available 
		FROM products p
		JOIN categories c ON p.category_id = c.id
		ORDER BY c.name ASC, p.name ASC
	`
	rows, err := h.DB.Pool.Query(ctx, query)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to query products")
		return
	}
	defer rows.Close()

	type ProductItem struct {
		ID           string  `json:"id"`
		Name         string  `json:"name"`
		CategoryID   string  `json:"category_id"`
		CategoryName string  `json:"category_name"`
		MRP          float64 `json:"mrp"`
		SellingPrice float64 `json:"selling_price"`
		ImageURL     string  `json:"image_url"`
		IsAvailable  bool    `json:"is_available"`
	}

	var list []ProductItem
	for rows.Next() {
		var p ProductItem
		err = rows.Scan(&p.ID, &p.Name, &p.CategoryID, &p.CategoryName, &p.MRP, &p.SellingPrice, &p.ImageURL, &p.IsAvailable)
		if err == nil {
			list = append(list, p)
		}
	}
	RespondJSON(w, http.StatusOK, list)
}

func (h *HandlerContext) CreateProduct(w http.ResponseWriter, r *http.Request) {
	adminID := r.Context().Value("user_id").(string)
	var req CreateProductRequest
	if err := jsonNewDecoder(r, &req); err != nil {
		RespondError(w, http.StatusBadRequest, "invalid payload")
		return
	}

	ctx := r.Context()
	query := `
		INSERT INTO products (name, category_id, mrp, selling_price, image_url, is_available)
		VALUES ($1, $2, $3, $4, $5, true)
		RETURNING id
	`
	var productID string
	err := h.DB.Pool.QueryRow(ctx, query, req.Name, req.CategoryID, req.MRP, req.SellingPrice, req.ImageURL).Scan(&productID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to insert product: "+err.Error())
		return
	}

	_ = h.AuditService.LogAction(ctx, adminID, "admin", "Created product: "+req.Name, r)

	RespondJSON(w, http.StatusCreated, map[string]string{"id": productID, "message": "Product created successfully"})
}

// Student Management Queue
func (h *HandlerContext) GetStudents(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	query := `
		SELECT s.id, s.mobile_number, s.short_name, s.roll_number, s.verification_status, s.registered_at, 
		       sd.id_card_url, sd.ocr_extracted_name, sd.ocr_extracted_roll_number, sd.name_similarity_score, sd.confidence_level
		FROM students s
		LEFT JOIN student_documents sd ON s.id = sd.student_id
		ORDER BY s.registered_at DESC
	`
	rows, err := h.DB.Pool.Query(ctx, query)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to query students")
		return
	}
	defer rows.Close()

	type StudentRecord struct {
		models.Student
		IDCardURL              string  `json:"id_card_url,omitempty"`
		OCRExtractedName       string  `json:"ocr_extracted_name,omitempty"`
		OCRExtractedRollNumber string  `json:"ocr_extracted_roll_number,omitempty"`
		NameSimilarityScore    float64 `json:"name_similarity_score,omitempty"`
		ConfidenceLevel        string  `json:"confidence_level,omitempty"`
	}

	var records []StudentRecord
	for rows.Next() {
		var rec StudentRecord
		var cardURL, ocrName, ocrRoll, conf sql.NullString
		var sim sql.NullFloat64

		err = rows.Scan(
			&rec.ID, &rec.MobileNumber, &rec.ShortName, &rec.RollNumber, &rec.VerificationStatus, &rec.RegisteredAt,
			&cardURL, &ocrName, &ocrRoll, &sim, &conf,
		)
		if err == nil {
			if cardURL.Valid {
				rec.IDCardURL = cardURL.String
				rec.OCRExtractedName = ocrName.String
				rec.OCRExtractedRollNumber = ocrRoll.String
				rec.NameSimilarityScore = sim.Float64
				rec.ConfidenceLevel = conf.String
			}
			records = append(records, rec)
		}
	}
	RespondJSON(w, http.StatusOK, records)
}

func (h *HandlerContext) UpdateStudentVerification(w http.ResponseWriter, r *http.Request) {
	studentID := getRouteParam(r, "id")
	adminID := r.Context().Value("user_id").(string)

	var req UpdateStudentVerificationRequest
	if err := jsonNewDecoder(r, &req); err != nil {
		RespondError(w, http.StatusBadRequest, "invalid request")
		return
	}

	if req.Status != models.VerificationStatusVerified && req.Status != models.VerificationStatusRejected {
		RespondError(w, http.StatusBadRequest, "status must be verified or rejected")
		return
	}

	ctx := r.Context()
	_, err := h.DB.Pool.Exec(ctx, `UPDATE students SET verification_status = $1 WHERE id = $2`, req.Status, studentID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to update status")
		return
	}

	_ = h.AuditService.LogAction(ctx, adminID, "admin", "Updated student "+studentID+" verification status to "+req.Status, r)

	RespondJSON(w, http.StatusOK, map[string]string{"message": "student status updated successfully"})
}

// Delivery Partners Setup
func (h *HandlerContext) CreateDeliveryPartner(w http.ResponseWriter, r *http.Request) {
	adminID := r.Context().Value("user_id").(string)
	var req CreatePartnerRequest
	if err := jsonNewDecoder(r, &req); err != nil {
		RespondError(w, http.StatusBadRequest, "invalid payload")
		return
	}

	ctx := r.Context()
	passHash, err := h.AuthService.HashPassword(req.Password)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "hashing failed")
		return
	}

	query := `
		INSERT INTO delivery_partners (name, mobile_number, password_hash, is_online)
		VALUES ($1, $2, $3, false)
		RETURNING id
	`
	var partnerID string
	err = h.DB.Pool.QueryRow(ctx, query, req.Name, req.MobileNumber, passHash).Scan(&partnerID)
	if err != nil {
		RespondError(w, http.StatusConflict, "mobile number already registered as partner")
		return
	}

	_ = h.AuditService.LogAction(ctx, adminID, "admin", "Onboarded delivery partner: "+req.Name, r)

	RespondJSON(w, http.StatusCreated, map[string]string{"id": partnerID, "message": "Delivery partner created successfully"})
}

func (h *HandlerContext) GetDeliveryPartners(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	rows, err := h.DB.Pool.Query(ctx, `SELECT id, name, mobile_number, is_online, current_building, current_floor FROM delivery_partners`)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to query delivery partners")
		return
	}
	defer rows.Close()

	var list []models.DeliveryPartner
	for rows.Next() {
		var dp models.DeliveryPartner
		var b sql.NullString
		var f sql.NullInt32
		err = rows.Scan(&dp.ID, &dp.Name, &dp.MobileNumber, &dp.IsOnline, &b, &f)
		if err == nil {
			if b.Valid {
				dp.CurrentBuilding = b.String
			}
			if f.Valid {
				dp.CurrentFloor = int(f.Int32)
			}
			list = append(list, dp)
		}
	}
	RespondJSON(w, http.StatusOK, list)
}

// AssignDeliveryPartner handles linking an order to a delivery partner.
func (h *HandlerContext) AssignDeliveryPartner(w http.ResponseWriter, r *http.Request) {
	orderID := getRouteParam(r, "id")
	adminID := r.Context().Value("user_id").(string)

	var req AssignPartnerRequest
	if err := jsonNewDecoder(r, &req); err != nil {
		RespondError(w, http.StatusBadRequest, "invalid assignment payload")
		return
	}

	ctx := r.Context()
	tx, err := h.DB.Pool.Begin(ctx)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "transaction initiation failed")
		return
	}
	defer tx.Rollback(ctx)

	// Check order is paid or received before assigning
	var currentStatus string
	err = tx.QueryRow(ctx, `SELECT status FROM orders WHERE id = $1`, orderID).Scan(&currentStatus)
	if err != nil {
		RespondError(w, http.StatusNotFound, "order not found")
		return
	}

	// Create/Update delivery assignment
	assignQuery := `
		INSERT INTO delivery_assignments (order_id, delivery_partner_id, assigned_at)
		VALUES ($1, $2, $3)
		ON CONFLICT (order_id) DO UPDATE SET delivery_partner_id = $2, assigned_at = $3
	`
	_, err = tx.Exec(ctx, assignQuery, orderID, req.DeliveryPartnerID, time.Now())
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to assign order: "+err.Error())
		return
	}

	// Update order status to assigned
	_, err = tx.Exec(ctx, `UPDATE orders SET status = 'assigned' WHERE id = $1`, orderID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to update order status")
		return
	}

	// Log status history transition
	_, err = tx.Exec(ctx, `INSERT INTO order_status_history (order_id, status, changed_by) VALUES ($1, 'assigned', $2)`, orderID, adminID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to write status history")
		return
	}

	err = tx.Commit(ctx)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to save assignment details")
		return
	}

	_ = h.AuditService.LogAction(ctx, adminID, "admin", "Assigned order "+orderID+" to partner "+req.DeliveryPartnerID, r)

	RespondJSON(w, http.StatusOK, map[string]string{"message": "order assigned to delivery partner successfully"})
}

// GetAuditLogs retrieves history tracking
func (h *HandlerContext) GetAuditLogs(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	logs, err := h.DB.Pool.Query(ctx, `SELECT id, actor_id, actor_role, action, ip_address, user_agent, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 100`)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to query audit logs")
		return
	}
	defer logs.Close()

	var list []models.AuditLog
	for logs.Next() {
		var a models.AuditLog
		err = logs.Scan(&a.ID, &a.ActorID, &a.ActorRole, &a.Action, &a.IPAddress, &a.UserAgent, &a.CreatedAt)
		if err == nil {
			list = append(list, a)
		}
	}

	RespondJSON(w, http.StatusOK, list)
}

// AdminGetOrders retrieves order metrics for the administration view
func (h *HandlerContext) AdminGetOrders(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	query := `
		SELECT o.id, o.order_number, o.student_id, s.short_name, s.mobile_number, o.room_number, o.building, o.floor, o.total_amount, o.status, o.created_at, p.status,
		       COALESCE(dp.name, ''), COALESCE(da.not_available_flag, false),
		       COALESCE((
		           SELECT string_agg(pr.name || ' x' || oi.quantity, ', ')
		           FROM order_items oi
		           JOIN products pr ON oi.product_id = pr.id
		           WHERE oi.order_id = o.id
		       ), 'No items') as items_summary
		FROM orders o
		JOIN students s ON o.student_id = s.id
		JOIN payments p ON o.id = p.order_id
		LEFT JOIN delivery_assignments da ON o.id = da.order_id
		LEFT JOIN delivery_partners dp ON da.delivery_partner_id = dp.id
		WHERE p.status = 'paid'
		ORDER BY o.created_at DESC
	`
	rows, err := h.DB.Pool.Query(ctx, query)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to query orders: "+err.Error())
		return
	}
	defer rows.Close()

	type OrderAdminItem struct {
		ID                  string    `json:"id"`
		OrderNumber         string    `json:"order_number"`
		StudentID           string    `json:"student_id"`
		StudentName         string    `json:"student_name"`
		StudentPhone        string    `json:"student_phone"`
		RoomNumber          string    `json:"room_number"`
		Building            string    `json:"building"`
		Floor               int       `json:"floor"`
		TotalAmount         float64   `json:"total_amount"`
		Status              string    `json:"status"`
		CreatedAt           time.Time `json:"created_at"`
		PaymentStatus       string    `json:"payment_status"`
		DeliveryPartnerName string    `json:"delivery_partner_name"`
		NotAvailableFlag    bool      `json:"not_available_flag"`
		ItemsSummary        string    `json:"items_summary"`
	}

	var list []OrderAdminItem
	for rows.Next() {
		var item OrderAdminItem
		err = rows.Scan(
			&item.ID, &item.OrderNumber, &item.StudentID, &item.StudentName, &item.StudentPhone, &item.RoomNumber, &item.Building, &item.Floor,
			&item.TotalAmount, &item.Status, &item.CreatedAt, &item.PaymentStatus, &item.DeliveryPartnerName,
			&item.NotAvailableFlag, &item.ItemsSummary,
		)
		if err == nil {
			list = append(list, item)
		}
	}
	RespondJSON(w, http.StatusOK, list)
}

type UpdateProductRequest struct {
	Name         string  `json:"name"`
	CategoryID   string  `json:"category_id"`
	MRP          float64 `json:"mrp"`
	SellingPrice float64 `json:"selling_price"`
	ImageURL     string  `json:"image_url"`
	IsAvailable  bool    `json:"is_available"`
}

func (h *HandlerContext) UpdateProduct(w http.ResponseWriter, r *http.Request) {
	adminID := r.Context().Value("user_id").(string)
	productID := chi.URLParam(r, "id")
	if productID == "" {
		RespondError(w, http.StatusBadRequest, "missing product ID")
		return
	}

	var req UpdateProductRequest
	if err := jsonNewDecoder(r, &req); err != nil {
		RespondError(w, http.StatusBadRequest, "invalid payload")
		return
	}

	ctx := r.Context()

	// Check if product exists
	var existingName string
	err := h.DB.Pool.QueryRow(ctx, "SELECT name FROM products WHERE id = $1", productID).Scan(&existingName)
	if err != nil {
		RespondError(w, http.StatusNotFound, "product not found")
		return
	}

	// Update query
	query := `
		UPDATE products
		SET name = $1, category_id = $2, mrp = $3, selling_price = $4, image_url = $5, is_available = $6
		WHERE id = $7
	`
	_, err = h.DB.Pool.Exec(ctx, query, req.Name, req.CategoryID, req.MRP, req.SellingPrice, req.ImageURL, req.IsAvailable, productID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to update product: "+err.Error())
		return
	}

	_ = h.AuditService.LogAction(ctx, adminID, "admin", "Updated product: "+existingName+" -> "+req.Name, r)

	RespondJSON(w, http.StatusOK, map[string]string{"message": "Product updated successfully"})
}

// CancelOrder handles marking an order as out of stock and triggering refunds.
func (h *HandlerContext) CancelOrder(w http.ResponseWriter, r *http.Request) {
	orderID := getRouteParam(r, "id")
	adminID := r.Context().Value("user_id").(string)
	ctx := r.Context()

	tx, err := h.DB.Pool.Begin(ctx)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "transaction failed")
		return
	}
	defer tx.Rollback(ctx)

	// Update order status to 'cancelled'
	_, err = tx.Exec(ctx, `UPDATE orders SET status = 'cancelled' WHERE id = $1`, orderID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to update order status")
		return
	}

	// Update payment status to 'refunded'
	_, err = tx.Exec(ctx, `UPDATE payments SET status = 'refunded' WHERE order_id = $1`, orderID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to update payment status")
		return
	}

	// Log order status history transition
	_, err = tx.Exec(ctx, `INSERT INTO order_status_history (order_id, status, changed_by) VALUES ($1, 'cancelled', $2)`, orderID, adminID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to save history log")
		return
	}

	err = tx.Commit(ctx)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to commit changes")
		return
	}

	_ = h.AuditService.LogAction(ctx, adminID, "admin", "Cancelled order "+orderID+" (Out of Stock / Refunded)", r)

	RespondJSON(w, http.StatusOK, map[string]string{"message": "order cancelled and marked as refunded successfully"})
}

// DeliverOrder handles manual order completion / counter handover.
func (h *HandlerContext) DeliverOrder(w http.ResponseWriter, r *http.Request) {
	orderID := getRouteParam(r, "id")
	adminID := r.Context().Value("user_id").(string)
	ctx := r.Context()

	tx, err := h.DB.Pool.Begin(ctx)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "transaction failed")
		return
	}
	defer tx.Rollback(ctx)

	// Update order status to delivered
	_, err = tx.Exec(ctx, `UPDATE orders SET status = 'delivered' WHERE id = $1`, orderID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to update order status")
		return
	}

	// Update delivery assignment delivered_at
	_, _ = tx.Exec(ctx, `UPDATE delivery_assignments SET delivered_at = $1 WHERE order_id = $2`, time.Now(), orderID)

	// Log status history transition
	_, err = tx.Exec(ctx, `INSERT INTO order_status_history (order_id, status, changed_by) VALUES ($1, 'delivered', $2)`, orderID, adminID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to write status history")
		return
	}

	err = tx.Commit(ctx)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to commit changes")
		return
	}

	_ = h.AuditService.LogAction(ctx, adminID, "admin", "Completed counter handover for order "+orderID, r)

	if h.FCMService != nil {
		var token sql.NullString
		err := h.DB.Pool.QueryRow(ctx, "SELECT s.fcm_token FROM orders o JOIN students s ON o.student_id = s.id WHERE o.id = $1", orderID).Scan(&token)
		if err == nil && token.Valid && token.String != "" {
			_ = h.FCMService.SendToUser(ctx, token.String, "Order Delivered! 🍕", "Your order has been handed over at the counter. Enjoy your meal!")
		}
	}

	RespondJSON(w, http.StatusOK, map[string]string{"message": "order marked as delivered"})
}

func parseCutoffTime(cutoffStr string) (int, int, error) {
	cutoffStr = strings.TrimSpace(cutoffStr)

	// Try 12-hour format "03:04 PM" or "3:04 PM"
	if strings.Contains(strings.ToUpper(cutoffStr), "AM") || strings.Contains(strings.ToUpper(cutoffStr), "PM") {
		t, err := time.Parse("03:04 PM", strings.ToUpper(cutoffStr))
		if err == nil {
			return t.Hour(), t.Minute(), nil
		}
		t, err = time.Parse("3:04 PM", strings.ToUpper(cutoffStr))
		if err == nil {
			return t.Hour(), t.Minute(), nil
		}
	}

	// Try 24-hour format "15:04"
	t, err := time.Parse("15:04", cutoffStr)
	if err == nil {
		return t.Hour(), t.Minute(), nil
	}

	return 0, 0, fmt.Errorf("invalid time format")
}

func (h *HandlerContext) GetCutoffTime(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	cutoff := "23:59"
	if h.Redis != nil && h.Redis.Client != nil {
		val, err := h.Redis.Client.Get(ctx, "order_cutoff_time").Result()
		if err == nil && val != "" {
			cutoff = val
		}
	}
	RespondJSON(w, http.StatusOK, map[string]string{"cutoff_time": cutoff})
}

type SetCutoffRequest struct {
	CutoffTime string `json:"cutoff_time"`
}

func (h *HandlerContext) SetCutoffTime(w http.ResponseWriter, r *http.Request) {
	var req SetCutoffRequest
	if err := jsonNewDecoder(r, &req); err != nil {
		RespondError(w, http.StatusBadRequest, "invalid request")
		return
	}

	_, _, err := parseCutoffTime(req.CutoffTime)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "Invalid time format. Please use 'HH:MM AM/PM' (e.g., 10:05 AM) or 'HH:MM' (e.g., 10:05)")
		return
	}

	ctx := r.Context()
	if h.Redis != nil && h.Redis.Client != nil {
		err = h.Redis.Client.Set(ctx, "order_cutoff_time", req.CutoffTime, 0).Err()
		if err != nil {
			RespondError(w, http.StatusInternalServerError, "failed to save to Redis: "+err.Error())
			return
		}
	}

	adminID := r.Context().Value("user_id").(string)
	_ = h.AuditService.LogAction(ctx, adminID, "admin", "Set order cutoff time to "+req.CutoffTime, r)

	RespondJSON(w, http.StatusOK, map[string]string{"message": "order cutoff time updated successfully"})
}

type AdminNotificationRequest struct {
	TargetStudent string `json:"target_student"` // "ALL" or specific student ID
	Title         string `json:"title"`
	Body          string `json:"body"`
}

// AdminSendNotification allows admins to send custom push notifications
func (h *HandlerContext) AdminSendNotification(w http.ResponseWriter, r *http.Request) {
	if h.FCMService == nil {
		RespondError(w, http.StatusInternalServerError, "FCM service not initialized")
		return
	}

	adminID := r.Context().Value("user_id").(string)
	
	var req AdminNotificationRequest
	if err := jsonNewDecoder(r, &req); err != nil {
		RespondError(w, http.StatusBadRequest, "invalid payload")
		return
	}

	if req.Title == "" || req.Body == "" {
		RespondError(w, http.StatusBadRequest, "title and body are required")
		return
	}

	ctx := r.Context()
	var tokens []string

	if req.TargetStudent == "ALL" {
		rows, err := h.DB.Pool.Query(ctx, "SELECT fcm_token FROM students WHERE fcm_token IS NOT NULL AND fcm_token != ''")
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var token string
				if err := rows.Scan(&token); err == nil {
					tokens = append(tokens, token)
				}
			}
		}
	} else {
		var token string
		err := h.DB.Pool.QueryRow(ctx, "SELECT fcm_token FROM students WHERE id = $1 AND fcm_token IS NOT NULL AND fcm_token != ''", req.TargetStudent).Scan(&token)
		if err == nil {
			tokens = append(tokens, token)
		}
	}

	if len(tokens) == 0 {
		RespondJSON(w, http.StatusOK, map[string]interface{}{"message": "No users found with valid FCM tokens", "targetCount": 0})
		return
	}

	// Send multicast
	err := h.FCMService.SendToTokens(ctx, tokens, req.Title, req.Body)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "Failed to send notifications")
		return
	}

	_ = h.AuditService.LogAction(ctx, adminID, "admin", fmt.Sprintf("Sent push notification: %s", req.Title), r)
	RespondJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Push notification dispatched",
		"targetCount": len(tokens),
	})
}

