package handlers

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

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

type CreateCategoryRequest struct {
	Name string `json:"name"`
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

// resolveCategoryID validates that value is a UUID and that the category exists.
func (h *HandlerContext) resolveCategoryID(ctx context.Context, value string) (string, error) {
	parsed, err := uuid.Parse(strings.TrimSpace(value))
	if err != nil {
		return "", fmt.Errorf("invalid category selected")
	}
	id := parsed.String()
	var exists bool
	err = h.DB.Pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM categories WHERE id = $1)", id).Scan(&exists)
	if err != nil {
		return "", fmt.Errorf("failed to validate category")
	}
	if !exists {
		return "", fmt.Errorf("invalid category selected")
	}
	return id, nil
}

// ListCategories returns all catalog categories.
func (h *HandlerContext) ListCategories(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	rows, err := h.DB.Pool.Query(ctx, `SELECT id, name FROM categories ORDER BY name ASC`)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to query categories")
		return
	}
	defer rows.Close()

	list := []models.Category{}
	for rows.Next() {
		var c models.Category
		if err := rows.Scan(&c.ID, &c.Name); err == nil {
			list = append(list, c)
		}
	}
	RespondJSON(w, http.StatusOK, list)
}

// CreateCategory creates a new category (or returns the existing one on name conflict).
func (h *HandlerContext) CreateCategory(w http.ResponseWriter, r *http.Request) {
	adminID := r.Context().Value("user_id").(string)
	var req CreateCategoryRequest
	if err := jsonNewDecoder(r, &req); err != nil {
		RespondError(w, http.StatusBadRequest, "invalid payload")
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		RespondError(w, http.StatusBadRequest, "category name is required")
		return
	}

	ctx := r.Context()
	var id string
	err := h.DB.Pool.QueryRow(ctx, `
		INSERT INTO categories (name) VALUES ($1)
		ON CONFLICT (name) DO NOTHING
		RETURNING id
	`, name).Scan(&id)
	if err != nil {
		// Conflict / no row returned — fetch existing
		err = h.DB.Pool.QueryRow(ctx, `SELECT id FROM categories WHERE name = $1`, name).Scan(&id)
		if err != nil {
			RespondError(w, http.StatusInternalServerError, "failed to create category")
			return
		}
	}

	_ = h.AuditService.LogAction(ctx, adminID, "admin", "Created category: "+name, r)

	RespondJSON(w, http.StatusCreated, models.Category{ID: id, Name: name})
}

func (h *HandlerContext) CreateProduct(w http.ResponseWriter, r *http.Request) {
	adminID := r.Context().Value("user_id").(string)
	var req CreateProductRequest
	if err := jsonNewDecoder(r, &req); err != nil {
		RespondError(w, http.StatusBadRequest, "invalid payload")
		return
	}

	ctx := r.Context()
	categoryID, err := h.resolveCategoryID(ctx, req.CategoryID)
	if err != nil {
		RespondError(w, http.StatusBadRequest, err.Error())
		return
	}

	query := `
		INSERT INTO products (name, category_id, mrp, selling_price, image_url, is_available)
		VALUES ($1, $2, $3, $4, $5, true)
		RETURNING id
	`
	var productID string
	err = h.DB.Pool.QueryRow(ctx, query, req.Name, categoryID, req.MRP, req.SellingPrice, req.ImageURL).Scan(&productID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to insert product")
		return
	}

	_ = h.AuditService.LogAction(ctx, adminID, "admin", "Created product: "+req.Name, r)

	RespondJSON(w, http.StatusCreated, map[string]string{"id": productID, "message": "Product created successfully"})
}

// Student Management Queue
func (h *HandlerContext) GetStudents(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	query := `
		SELECT s.id::text, s.mobile_number, s.short_name, s.roll_number, COALESCE(s.verification_status::text, 'pending'), s.registered_at, 
		       COALESCE(sd.id_card_url, ''), COALESCE(sd.ocr_extracted_name, ''), COALESCE(sd.ocr_extracted_roll_number, ''), COALESCE(sd.name_similarity_score, 0.0), COALESCE(sd.confidence_level::text, 'low')
		FROM students s
		LEFT JOIN student_documents sd ON s.id = sd.student_id
		ORDER BY s.registered_at DESC
	`
	rows, err := h.DB.Pool.Query(ctx, query)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to query students: "+err.Error())
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

	records := []StudentRecord{}
	for rows.Next() {
		var rec StudentRecord
		err = rows.Scan(
			&rec.ID, &rec.MobileNumber, &rec.ShortName, &rec.RollNumber, &rec.VerificationStatus, &rec.RegisteredAt,
			&rec.IDCardURL, &rec.OCRExtractedName, &rec.OCRExtractedRollNumber, &rec.NameSimilarityScore, &rec.ConfidenceLevel,
		)
		if err != nil {
			log.Printf("Error scanning student record: %v", err)
			continue
		}
		records = append(records, rec)
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

	req.Name = strings.TrimSpace(req.Name)
	req.MobileNumber = strings.TrimSpace(req.MobileNumber)

	if req.Name == "" || req.MobileNumber == "" || req.Password == "" {
		RespondError(w, http.StatusBadRequest, "name, mobile number, and password are required")
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
		RETURNING id::text
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
	rows, err := h.DB.Pool.Query(ctx, `
		SELECT id::text, name, mobile_number, COALESCE(is_online, false), COALESCE(current_building, ''), COALESCE(current_floor, 0)
		FROM delivery_partners
		ORDER BY name ASC
	`)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to query delivery partners: "+err.Error())
		return
	}
	defer rows.Close()

	list := []models.DeliveryPartner{}
	for rows.Next() {
		var dp models.DeliveryPartner
		err = rows.Scan(&dp.ID, &dp.Name, &dp.MobileNumber, &dp.IsOnline, &dp.CurrentBuilding, &dp.CurrentFloor)
		if err != nil {
			log.Printf("Error scanning delivery partner row: %v", err)
			continue
		}
		list = append(list, dp)
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

	var currentStatus, paymentStatus string
	err = tx.QueryRow(ctx, `
		SELECT o.status, p.status
		FROM orders o
		JOIN payments p ON p.order_id = o.id
		WHERE o.id = $1
	`, orderID).Scan(&currentStatus, &paymentStatus)
	if err != nil {
		RespondError(w, http.StatusNotFound, "order not found")
		return
	}
	if paymentStatus != models.PaymentStatusPaid {
		RespondError(w, http.StatusBadRequest, "cannot assign unpaid order")
		return
	}
	if currentStatus == models.OrderStatusOutOfStock || currentStatus == models.OrderStatusCancelled || currentStatus == models.OrderStatusDelivered {
		RespondError(w, http.StatusBadRequest, "order cannot be assigned in status: "+currentStatus)
		return
	}
	if currentStatus != models.OrderStatusReceived && currentStatus != models.OrderStatusPreparing && currentStatus != models.OrderStatusPacked {
		RespondError(w, http.StatusBadRequest, "order cannot be assigned in status: "+currentStatus)
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
func (h *HandlerContext) loadOrderItemsForOrder(ctx context.Context, orderID string) []models.OrderItem {
	query := `
		SELECT oi.id, oi.product_id, COALESCE(pr.name, 'Item'), oi.quantity, oi.unit_price
		FROM order_items oi
		LEFT JOIN products pr ON oi.product_id = pr.id
		WHERE oi.order_id = $1
	`
	rows, err := h.DB.Pool.Query(ctx, query, orderID)
	if err != nil {
		return nil
	}
	defer rows.Close()

	var items []models.OrderItem
	for rows.Next() {
		var item models.OrderItem
		var productName string
		if err := rows.Scan(&item.ID, &item.ProductID, &productName, &item.Quantity, &item.UnitPrice); err == nil {
			item.ProductName = productName
			items = append(items, item)
		}
	}
	return items
}

func (h *HandlerContext) AdminGetOrders(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	query := `
		SELECT o.id, o.order_number, o.student_id, COALESCE(s.short_name, 'Student'), COALESCE(s.mobile_number, ''), o.room_number, o.building, o.floor, o.total_amount, o.status, o.created_at, COALESCE(p.status, 'paid'),
		       COALESCE(dp.name, ''), COALESCE(dp.id::text, ''), COALESCE(da.not_available_flag, false),
		       COALESCE((
		           SELECT string_agg(pr.name || ' x' || oi.quantity, ', ')
		           FROM order_items oi
		           JOIN products pr ON oi.product_id = pr.id
		           WHERE oi.order_id = o.id
		       ), 'No items') as items_summary,
		       COALESCE(ds.name, ''),
		       COALESCE(TO_CHAR(ds.delivery_start, 'HH24:MI'), ''),
		       COALESCE(TO_CHAR(ds.delivery_end, 'HH24:MI'), '')
		FROM orders o
		LEFT JOIN students s ON o.student_id = s.id
		JOIN payments p ON o.id = p.order_id
		LEFT JOIN delivery_assignments da ON o.id = da.order_id
		LEFT JOIN delivery_partners dp ON da.delivery_partner_id = dp.id
		LEFT JOIN delivery_slots ds ON o.delivery_slot_id = ds.id
		WHERE p.status IN ('paid', 'reconciliation_required')
		ORDER BY o.created_at DESC
	`
	rows, err := h.DB.Pool.Query(ctx, query)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to query orders: "+err.Error())
		return
	}
	defer rows.Close()

	type OrderAdminItem struct {
		ID                  string             `json:"id"`
		OrderNumber         string             `json:"order_number"`
		StudentID           string             `json:"student_id"`
		StudentName         string             `json:"student_name"`
		StudentPhone        string             `json:"student_phone"`
		RoomNumber          string             `json:"room_number"`
		Building            string             `json:"building"`
		Floor               int                `json:"floor"`
		TotalAmount         float64            `json:"total_amount"`
		Status              string             `json:"status"`
		CreatedAt           time.Time          `json:"created_at"`
		PaymentStatus       string             `json:"payment_status"`
		DeliveryPartnerName string             `json:"delivery_partner_name"`
		DeliveryPartnerID   string             `json:"delivery_partner_id"`
		NotAvailableFlag    bool               `json:"not_available_flag"`
		ItemsSummary        string             `json:"items_summary"`
		Items               []models.OrderItem `json:"items,omitempty"`
		PrintJobsSummary    string             `json:"print_jobs_summary"`
		PrintJobs           []models.PrintJob  `json:"print_jobs,omitempty"`
		SlotName            string             `json:"slot_name"`
		SlotDeliveryStart   string             `json:"slot_delivery_start"`
		SlotDeliveryEnd     string             `json:"slot_delivery_end"`
	}

	var list []OrderAdminItem
	for rows.Next() {
		var item OrderAdminItem
		err = rows.Scan(
			&item.ID, &item.OrderNumber, &item.StudentID, &item.StudentName, &item.StudentPhone, &item.RoomNumber, &item.Building, &item.Floor,
			&item.TotalAmount, &item.Status, &item.CreatedAt, &item.PaymentStatus, &item.DeliveryPartnerName, &item.DeliveryPartnerID,
			&item.NotAvailableFlag, &item.ItemsSummary,
			&item.SlotName, &item.SlotDeliveryStart, &item.SlotDeliveryEnd,
		)
		if err == nil {
			item.Items = h.loadOrderItemsForOrder(ctx, item.ID)
			item.PrintJobs = h.loadPrintJobsForOrder(ctx, item.ID)
			item.PrintJobsSummary = printJobsSummary(item.PrintJobs)
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

	categoryID, err := h.resolveCategoryID(ctx, req.CategoryID)
	if err != nil {
		RespondError(w, http.StatusBadRequest, err.Error())
		return
	}

	// Check if product exists
	var existingName string
	err = h.DB.Pool.QueryRow(ctx, "SELECT name FROM products WHERE id = $1", productID).Scan(&existingName)
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
	_, err = h.DB.Pool.Exec(ctx, query, req.Name, categoryID, req.MRP, req.SellingPrice, req.ImageURL, req.IsAvailable, productID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to update product")
		return
	}

	_ = h.AuditService.LogAction(ctx, adminID, "admin", "Updated product: "+existingName+" -> "+req.Name, r)

	RespondJSON(w, http.StatusOK, map[string]string{"message": "Product updated successfully"})
}

// MarkOrderOutOfStock marks a paid order as out of stock for manual refund (no Razorpay call).
func (h *HandlerContext) MarkOrderOutOfStock(w http.ResponseWriter, r *http.Request) {
	orderID := getRouteParam(r, "id")
	adminID := r.Context().Value("user_id").(string)
	ctx := r.Context()

	var orderStatus string
	err := h.DB.Pool.QueryRow(ctx, `SELECT status FROM orders WHERE id = $1`, orderID).Scan(&orderStatus)
	if err != nil {
		RespondError(w, http.StatusNotFound, "order not found")
		return
	}
	if orderStatus == models.OrderStatusOutOfStock {
		RespondJSON(w, http.StatusOK, map[string]string{"message": "order already marked out of stock"})
		return
	}
	if orderStatus == models.OrderStatusDelivered {
		RespondError(w, http.StatusBadRequest, "cannot mark a delivered order as out of stock")
		return
	}
	if orderStatus == models.OrderStatusCancelled {
		RespondError(w, http.StatusBadRequest, "cannot mark a cancelled order as out of stock")
		return
	}

	tx, err := h.DB.Pool.Begin(ctx)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "transaction failed")
		return
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `UPDATE orders SET status = $1 WHERE id = $2`, models.OrderStatusOutOfStock, orderID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to update order status")
		return
	}

	_, err = tx.Exec(ctx, `INSERT INTO order_status_history (order_id, status, changed_by) VALUES ($1, $2, $3)`, orderID, models.OrderStatusOutOfStock, adminID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to save history log")
		return
	}

	if err = tx.Commit(ctx); err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to commit changes")
		return
	}

	_ = h.AuditService.LogAction(ctx, adminID, "admin", "Marked order out of stock "+orderID, r)
	RespondJSON(w, http.StatusOK, map[string]string{"message": "order marked out of stock"})
}

// CancelOrder handles marking an order as cancelled and refunding paid payments via Razorpay.
func (h *HandlerContext) CancelOrder(w http.ResponseWriter, r *http.Request) {
	orderID := getRouteParam(r, "id")
	adminID := r.Context().Value("user_id").(string)
	ctx := r.Context()

	var orderStatus, paymentStatus string
	var razorpayPaymentID sql.NullString
	err := h.DB.Pool.QueryRow(ctx, `
		SELECT o.status, p.status, p.razorpay_payment_id
		FROM orders o
		JOIN payments p ON p.order_id = o.id
		WHERE o.id = $1
	`, orderID).Scan(&orderStatus, &paymentStatus, &razorpayPaymentID)
	if err != nil {
		RespondError(w, http.StatusNotFound, "order not found")
		return
	}
	if orderStatus == models.OrderStatusCancelled {
		RespondJSON(w, http.StatusOK, map[string]string{"message": "order already cancelled"})
		return
	}
	if orderStatus == models.OrderStatusDelivered {
		RespondError(w, http.StatusBadRequest, "cannot cancel a delivered order")
		return
	}

	refunded := false
	if paymentStatus == models.PaymentStatusPaid {
		if !razorpayPaymentID.Valid || razorpayPaymentID.String == "" {
			RespondError(w, http.StatusBadRequest, "paid order has no razorpay payment id; cannot refund")
			return
		}
		if err := h.PaymentService.CreateRefund(razorpayPaymentID.String); err != nil {
			RespondError(w, http.StatusBadGateway, "razorpay refund failed: "+err.Error())
			return
		}
		refunded = true
	}

	tx, err := h.DB.Pool.Begin(ctx)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "transaction failed")
		return
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `UPDATE orders SET status = $1 WHERE id = $2 AND status <> $1`, models.OrderStatusCancelled, orderID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to update order status")
		return
	}

	if refunded {
		_, err = tx.Exec(ctx, `UPDATE payments SET status = $1 WHERE order_id = $2`, models.PaymentStatusRefunded, orderID)
	} else if paymentStatus == models.PaymentStatusCreated {
		_, err = tx.Exec(ctx, `UPDATE payments SET status = $1 WHERE order_id = $2`, models.PaymentStatusFailed, orderID)
	}
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to update payment status")
		return
	}

	_, err = tx.Exec(ctx, `INSERT INTO order_status_history (order_id, status, changed_by) VALUES ($1, $2, $3)`, orderID, models.OrderStatusCancelled, adminID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to save history log")
		return
	}

	err = tx.Commit(ctx)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to commit changes")
		return
	}

	msg := "order cancelled successfully"
	if refunded {
		msg = "order cancelled and refunded successfully"
	}
	_ = h.AuditService.LogAction(ctx, adminID, "admin", "Cancelled order "+orderID, r)

	RespondJSON(w, http.StatusOK, map[string]string{"message": msg})
}

// DeliverOrder handles manual order completion / counter handover.
func (h *HandlerContext) DeliverOrder(w http.ResponseWriter, r *http.Request) {
	orderID := getRouteParam(r, "id")
	adminID := r.Context().Value("user_id").(string)
	ctx := r.Context()

	var orderStatus, paymentStatus string
	err := h.DB.Pool.QueryRow(ctx, `
		SELECT o.status, p.status
		FROM orders o
		JOIN payments p ON p.order_id = o.id
		WHERE o.id = $1
	`, orderID).Scan(&orderStatus, &paymentStatus)
	if err != nil {
		RespondError(w, http.StatusNotFound, "order not found")
		return
	}
	if paymentStatus != models.PaymentStatusPaid {
		RespondError(w, http.StatusBadRequest, "cannot deliver unpaid order")
		return
	}
	if orderStatus == models.OrderStatusDelivered || orderStatus == models.OrderStatusCancelled {
		RespondError(w, http.StatusBadRequest, "order cannot be delivered in status: "+orderStatus)
		return
	}

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

	h.cleanupPrintFilesForOrder(ctx, orderID)

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

	// Try 12-hour format "03:04 PM" or "3:04 PM" or "3:04PM" or "03:04PM"
	upper := strings.ToUpper(cutoffStr)
	if strings.Contains(upper, "AM") || strings.Contains(upper, "PM") {
		// Normalize spaces before AM/PM
		upper = strings.ReplaceAll(upper, "AM", " AM")
		upper = strings.ReplaceAll(upper, "PM", " PM")
		upper = strings.Join(strings.Fields(upper), " ")

		t, err := time.Parse("03:04 PM", upper)
		if err == nil {
			return t.Hour(), t.Minute(), nil
		}
		t, err = time.Parse("3:04 PM", upper)
		if err == nil {
			return t.Hour(), t.Minute(), nil
		}
	}

	// Try 24-hour format "15:04" or "3:04"
	t, err := time.Parse("15:04", cutoffStr)
	if err == nil {
		return t.Hour(), t.Minute(), nil
	}
	t, err = time.Parse("3:04", cutoffStr)
	if err == nil {
		return t.Hour(), t.Minute(), nil
	}

	return 0, 0, fmt.Errorf("invalid time format")
}

func (h *HandlerContext) GetCutoffTime(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	cutoff := ""

	// 1. Query persistent PostgreSQL system_config table (Source of Truth)
	_ = h.DB.Pool.QueryRow(ctx, `SELECT value FROM system_config WHERE key = 'order_cutoff_time'`).Scan(&cutoff)

	// 2. If empty in PostgreSQL, check Redis cache
	if cutoff == "" && h.Redis != nil && h.Redis.Client != nil {
		val, err := h.Redis.Client.Get(ctx, "order_cutoff_time").Result()
		if err == nil && val != "" {
			cutoff = val
		}
	}

	// 3. Fallback default if empty
	if cutoff == "" {
		cutoff = "10:05 AM"
	}

	// Sync Redis with the latest PostgreSQL database value
	if h.Redis != nil && h.Redis.Client != nil {
		_ = h.Redis.Client.Set(ctx, "order_cutoff_time", cutoff, 0).Err()
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

	req.CutoffTime = strings.TrimSpace(req.CutoffTime)
	if req.CutoffTime == "" {
		RespondError(w, http.StatusBadRequest, "cutoff_time is required")
		return
	}

	_, _, err := parseCutoffTime(req.CutoffTime)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "Invalid time format. Please use 'HH:MM AM/PM' (e.g., 10:05 AM) or 'HH:MM' (e.g., 10:05)")
		return
	}

	ctx := r.Context()

	// 1. Save to PostgreSQL database persistently
	_, _ = h.DB.Pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS system_config (
			key VARCHAR(50) PRIMARY KEY,
			value TEXT NOT NULL,
			updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
		)
	`)
	_, err = h.DB.Pool.Exec(ctx, `
		INSERT INTO system_config (key, value, updated_at)
		VALUES ('order_cutoff_time', $1, NOW())
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
	`, req.CutoffTime)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to save cutoff time to database: "+err.Error())
		return
	}

	// 2. Update Redis cache if available
	if h.Redis != nil && h.Redis.Client != nil {
		_ = h.Redis.Client.Set(ctx, "order_cutoff_time", req.CutoffTime, 0).Err()
	}

	adminID, ok := r.Context().Value("user_id").(string)
	if !ok {
		adminID = "system"
	}
	_ = h.AuditService.LogAction(ctx, adminID, "admin", "Set order cutoff time to "+req.CutoffTime, r)

	RespondJSON(w, http.StatusOK, map[string]string{
		"message":     "order cutoff time updated successfully",
		"cutoff_time": req.CutoffTime,
	})
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
		RespondError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to send notifications: %v", err))
		return
	}

	_ = h.AuditService.LogAction(ctx, adminID, "admin", fmt.Sprintf("Sent push notification: %s", req.Title), r)
	RespondJSON(w, http.StatusOK, map[string]interface{}{
		"message":     "Push notification dispatched",
		"targetCount": len(tokens),
	})
}

// GetDeliveryConfig fetches the current dynamic delivery configuration
func (h *HandlerContext) GetDeliveryConfig(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var config models.DeliveryConfig
	err := h.DB.Pool.QueryRow(ctx, `
		SELECT delivery_fee, min_free_delivery_amount
		FROM delivery_config
		ORDER BY updated_at DESC LIMIT 1
	`).Scan(&config.DeliveryFee, &config.MinFreeDeliveryAmount)

	if err != nil {
		config.DeliveryFee = 15.00
		config.MinFreeDeliveryAmount = 100.00
	}

	RespondJSON(w, http.StatusOK, config)
}

// UpdateDeliveryConfig updates the dynamic delivery settings
func (h *HandlerContext) UpdateDeliveryConfig(w http.ResponseWriter, r *http.Request) {
	adminID, ok := r.Context().Value("user_id").(string)
	if !ok || adminID == "" {
		RespondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req models.DeliveryConfig
	if err := jsonNewDecoder(r, &req); err != nil {
		RespondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.DeliveryFee < 0 || req.MinFreeDeliveryAmount < 0 {
		RespondError(w, http.StatusBadRequest, "delivery amounts cannot be negative")
		return
	}

	ctx := r.Context()
	var configID string
	err := h.DB.Pool.QueryRow(ctx, `
		INSERT INTO delivery_config (delivery_fee, min_free_delivery_amount, updated_at)
		VALUES ($1, $2, NOW())
		RETURNING id
	`, req.DeliveryFee, req.MinFreeDeliveryAmount).Scan(&configID)

	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to update delivery config")
		return
	}

	_ = h.AuditService.LogAction(ctx, adminID, "admin", fmt.Sprintf("Updated delivery fee to ₹%.2f, min free delivery threshold to ₹%.2f", req.DeliveryFee, req.MinFreeDeliveryAmount), r)
	RespondJSON(w, http.StatusOK, map[string]interface{}{
		"status":                   "success",
		"delivery_fee":             req.DeliveryFee,
		"min_free_delivery_amount": req.MinFreeDeliveryAmount,
	})
}

// ListMenuSchedules returns all menu schedules with their assigned categories
func (h *HandlerContext) ListMenuSchedules(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	h.ensureMenuScheduleTables(ctx)

	query := `
		SELECT ms.id, ms.name, TO_CHAR(ms.start_time, 'HH24:MI'), TO_CHAR(ms.end_time, 'HH24:MI'), ms.is_enabled, ms.display_order
		FROM menu_schedules ms
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

func (h *HandlerContext) getMenuScheduleCategories(ctx context.Context, scheduleID string) []models.MenuScheduleCategory {
	query := `
		SELECT msc.id, msc.schedule_id, msc.category_id, c.name, msc.display_order
		FROM menu_schedule_categories msc
		JOIN categories c ON msc.category_id = c.id
		WHERE msc.schedule_id = $1
		ORDER BY msc.display_order ASC
	`
	rows, err := h.DB.Pool.Query(ctx, query, scheduleID)
	if err != nil {
		return []models.MenuScheduleCategory{}
	}
	defer rows.Close()

	var list []models.MenuScheduleCategory
	for rows.Next() {
		var cat models.MenuScheduleCategory
		if err := rows.Scan(&cat.ID, &cat.ScheduleID, &cat.CategoryID, &cat.CategoryName, &cat.DisplayOrder); err == nil {
			list = append(list, cat)
		}
	}
	if list == nil {
		list = []models.MenuScheduleCategory{}
	}
	return list
}

// CreateMenuSchedule creates a new menu schedule window
func (h *HandlerContext) CreateMenuSchedule(w http.ResponseWriter, r *http.Request) {
	adminID, ok := r.Context().Value("user_id").(string)
	if !ok || adminID == "" {
		RespondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req struct {
		Name         string   `json:"name"`
		StartTime    string   `json:"start_time"`
		EndTime      string   `json:"end_time"`
		IsEnabled    bool     `json:"is_enabled"`
		DisplayOrder int      `json:"display_order"`
		CategoryIDs  []string `json:"category_ids"`
	}
	if err := jsonNewDecoder(r, &req); err != nil {
		RespondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Name == "" || req.StartTime == "" || req.EndTime == "" {
		RespondError(w, http.StatusBadRequest, "name, start_time and end_time are required")
		return
	}

	ctx := r.Context()
	tx, err := h.DB.Pool.Begin(ctx)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to start transaction")
		return
	}
	defer tx.Rollback(ctx)

	var scheduleID string
	err = tx.QueryRow(ctx, `
		INSERT INTO menu_schedules (name, start_time, end_time, is_enabled, display_order, created_at, updated_at)
		VALUES ($1, $2::TIME, $3::TIME, $4, $5, NOW(), NOW())
		RETURNING id
	`, req.Name, req.StartTime, req.EndTime, req.IsEnabled, req.DisplayOrder).Scan(&scheduleID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to insert menu schedule: "+err.Error())
		return
	}

	for idx, catID := range req.CategoryIDs {
		if catID != "" {
			_, _ = tx.Exec(ctx, `
				INSERT INTO menu_schedule_categories (schedule_id, category_id, display_order)
				VALUES ($1, $2, $3)
				ON CONFLICT DO NOTHING
			`, scheduleID, catID, idx+1)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to commit menu schedule")
		return
	}

	_ = h.AuditService.LogAction(ctx, adminID, "admin", fmt.Sprintf("Created menu schedule: %s (%s-%s)", req.Name, req.StartTime, req.EndTime), r)
	RespondJSON(w, http.StatusCreated, map[string]interface{}{"status": "success", "id": scheduleID})
}

// UpdateMenuSchedule updates a schedule and its assigned categories
func (h *HandlerContext) UpdateMenuSchedule(w http.ResponseWriter, r *http.Request) {
	adminID, ok := r.Context().Value("user_id").(string)
	if !ok || adminID == "" {
		RespondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	scheduleID := chi.URLParam(r, "id")
	if scheduleID == "" {
		RespondError(w, http.StatusBadRequest, "schedule id required")
		return
	}

	var req struct {
		Name         string   `json:"name"`
		StartTime    string   `json:"start_time"`
		EndTime      string   `json:"end_time"`
		IsEnabled    bool     `json:"is_enabled"`
		DisplayOrder int      `json:"display_order"`
		CategoryIDs  []string `json:"category_ids"`
	}
	if err := jsonNewDecoder(r, &req); err != nil {
		RespondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	ctx := r.Context()
	tx, err := h.DB.Pool.Begin(ctx)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to start transaction")
		return
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `
		UPDATE menu_schedules
		SET name = $1, start_time = $2::TIME, end_time = $3::TIME, is_enabled = $4, display_order = $5, updated_at = NOW()
		WHERE id = $6
	`, req.Name, req.StartTime, req.EndTime, req.IsEnabled, req.DisplayOrder, scheduleID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to update schedule: "+err.Error())
		return
	}

	_, _ = tx.Exec(ctx, `DELETE FROM menu_schedule_categories WHERE schedule_id = $1`, scheduleID)

	for idx, catID := range req.CategoryIDs {
		if catID != "" {
			_, _ = tx.Exec(ctx, `
				INSERT INTO menu_schedule_categories (schedule_id, category_id, display_order)
				VALUES ($1, $2, $3)
				ON CONFLICT DO NOTHING
			`, scheduleID, catID, idx+1)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to commit schedule update")
		return
	}

	_ = h.AuditService.LogAction(ctx, adminID, "admin", fmt.Sprintf("Updated menu schedule: %s", req.Name), r)
	RespondJSON(w, http.StatusOK, map[string]string{"status": "success"})
}

// DeleteMenuSchedule removes a schedule
func (h *HandlerContext) DeleteMenuSchedule(w http.ResponseWriter, r *http.Request) {
	adminID, ok := r.Context().Value("user_id").(string)
	if !ok || adminID == "" {
		RespondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	scheduleID := chi.URLParam(r, "id")
	if scheduleID == "" {
		RespondError(w, http.StatusBadRequest, "schedule id required")
		return
	}

	ctx := r.Context()
	_, err := h.DB.Pool.Exec(ctx, `DELETE FROM menu_schedules WHERE id = $1`, scheduleID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to delete schedule")
		return
	}

	_ = h.AuditService.LogAction(ctx, adminID, "admin", fmt.Sprintf("Deleted menu schedule: %s", scheduleID), r)
	RespondJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// AdminGetPaymentHealth retrieves detailed payment transaction logs for admin monitoring.
func (h *HandlerContext) AdminGetPaymentHealth(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	query := `
		SELECT p.id, p.order_id, o.order_number, COALESCE(s.short_name, 'Student'), COALESCE(s.mobile_number, ''),
		       p.razorpay_order_id, COALESCE(p.razorpay_payment_id, ''), p.amount, p.status::text,
		       p.reconciled_at, COALESCE(p.reconciliation_notes, ''), p.reconciliation_attempt_count,
		       COALESCE(p.last_reconciliation_error, ''), p.last_reconciliation_at,
		       COALESCE(p.reconciliation_source, ''), COALESCE(p.razorpay_status, ''), p.created_at
		FROM payments p
		JOIN orders o ON p.order_id = o.id
		LEFT JOIN students s ON o.student_id = s.id
		ORDER BY p.created_at DESC
		LIMIT 200
	`
	rows, err := h.DB.Pool.Query(ctx, query)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to query payment health: "+err.Error())
		return
	}
	defer rows.Close()

	type PaymentHealthRecord struct {
		ID                         string     `json:"id"`
		OrderID                    string     `json:"order_id"`
		OrderNumber                string     `json:"order_number"`
		StudentName                string     `json:"student_name"`
		StudentPhone               string     `json:"student_phone"`
		RazorpayOrderID            string     `json:"razorpay_order_id"`
		RazorpayPaymentID          string     `json:"razorpay_payment_id"`
		Amount                     float64    `json:"amount"`
		Status                     string     `json:"status"`
		ReconciledAt               *time.Time `json:"reconciled_at"`
		ReconciliationNotes        string     `json:"reconciliation_notes"`
		ReconciliationAttemptCount int        `json:"reconciliation_attempt_count"`
		LastReconciliationError    string     `json:"last_reconciliation_error"`
		LastReconciliationAt       *time.Time `json:"last_reconciliation_at"`
		ReconciliationSource       string     `json:"reconciliation_source"`
		RazorpayStatus             string     `json:"razorpay_status"`
		CreatedAt                  time.Time  `json:"created_at"`
	}

	var list []PaymentHealthRecord
	for rows.Next() {
		var rec PaymentHealthRecord
		err = rows.Scan(
			&rec.ID, &rec.OrderID, &rec.OrderNumber, &rec.StudentName, &rec.StudentPhone,
			&rec.RazorpayOrderID, &rec.RazorpayPaymentID, &rec.Amount, &rec.Status,
			&rec.ReconciledAt, &rec.ReconciliationNotes, &rec.ReconciliationAttemptCount,
			&rec.LastReconciliationError, &rec.LastReconciliationAt,
			&rec.ReconciliationSource, &rec.RazorpayStatus, &rec.CreatedAt,
		)
		if err == nil {
			list = append(list, rec)
		}
	}
	RespondJSON(w, http.StatusOK, list)
}

// AdminReconcilePayment allows admins to trigger a 1-click manual reconciliation for any order.
func (h *HandlerContext) AdminReconcilePayment(w http.ResponseWriter, r *http.Request) {
	adminID := r.Context().Value("user_id").(string)
	paymentID := chi.URLParam(r, "id")
	ctx := r.Context()

	var rzpOrderID, rzpPaymentID string
	var amount float64
	err := h.DB.Pool.QueryRow(ctx, "SELECT razorpay_order_id, COALESCE(razorpay_payment_id, ''), amount FROM payments WHERE id = $1 OR order_id = $1", paymentID).Scan(&rzpOrderID, &rzpPaymentID, &amount)
	if err != nil {
		RespondError(w, http.StatusNotFound, "payment record not found")
		return
	}

	if rzpOrderID == "" {
		RespondError(w, http.StatusBadRequest, "razorpay_order_id is missing for this record")
		return
	}

	// Fetch payments from Razorpay API
	paymentsList, err := h.PaymentService.FetchRazorpayOrderPayments(rzpOrderID)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "failed to query Razorpay REST API: "+err.Error())
		return
	}

	var capturedID string
	var capturedAmount int64
	var currency string = "INR"
	for _, p := range paymentsList {
		if strings.ToLower(p.Status) == "captured" || strings.ToLower(p.Status) == "paid" || p.Captured {
			capturedID = p.ID
			capturedAmount = p.Amount
			currency = p.Currency
			break
		}
	}

	if capturedID == "" {
		RespondError(w, http.StatusConflict, fmt.Sprintf("Razorpay reports no captured payment for order %s (%d attempts found)", rzpOrderID, len(paymentsList)))
		return
	}

	// Confirm payment and recover order
	err = h.ConfirmPaymentAndOrder(ctx, rzpOrderID, capturedID, "", "admin_manual", capturedAmount, currency, "")
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "manual reconciliation failed: "+err.Error())
		return
	}

	_ = h.AuditService.LogAction(ctx, adminID, "admin", "Manually reconciled payment "+paymentID+" (Razorpay Order "+rzpOrderID+")", r)

	RespondJSON(w, http.StatusOK, map[string]string{
		"message":             "Payment successfully reconciled and order confirmed!",
		"razorpay_order_id":   rzpOrderID,
		"razorpay_payment_id": capturedID,
	})
}
