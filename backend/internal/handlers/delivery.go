package handlers

import (
	"database/sql"
	"net/http"
	"time"

	"campusbites/backend/internal/models"
)

type DeliveryLoginRequest struct {
	MobileNumber string `json:"mobile_number"`
	Password     string `json:"password"`
}

type UpdateNotesRequest struct {
	Notes string `json:"notes"`
}

// DeliveryLogin authenticates a delivery partner and returns a JWT.
func (h *HandlerContext) DeliveryLogin(w http.ResponseWriter, r *http.Request) {
	var req DeliveryLoginRequest
	if err := jsonNewDecoder(r, &req); err != nil {
		RespondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	ctx := r.Context()
	var id, name, passHash string
	var isOnline bool

	query := `SELECT id, name, password_hash, is_online FROM delivery_partners WHERE mobile_number = $1`
	err := h.DB.Pool.QueryRow(ctx, query, req.MobileNumber).Scan(&id, &name, &passHash, &isOnline)
	if err != nil {
		RespondError(w, http.StatusUnauthorized, "invalid mobile number or password")
		return
	}

	// Verify hashed password using Argon2id via AuthService
	match, err := h.AuthService.VerifyPassword(req.Password, passHash)
	if err != nil || !match {
		RespondError(w, http.StatusUnauthorized, "invalid mobile number or password")
		return
	}

	// Update status to online
	_, _ = h.DB.Pool.Exec(ctx, `UPDATE delivery_partners SET is_online = true WHERE id = $1`, id)

	token, err := h.AuthService.GenerateJWT(id, "delivery")
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to generate access token")
		return
	}

	RespondJSON(w, http.StatusOK, map[string]interface{}{
		"token": token,
		"delivery_partner": map[string]interface{}{
			"id":            id,
			"name":          name,
			"mobile_number": req.MobileNumber,
			"is_online":     true,
		},
	})
}

// GetAssignedOrders fetches only orders assigned to the logged-in partner, grouped logically.
func (h *HandlerContext) GetAssignedOrders(w http.ResponseWriter, r *http.Request) {
	partnerID := r.Context().Value("user_id").(string)
	ctx := r.Context()

	// Query only non-delivered/non-cancelled orders assigned to this partner.
	// Sort by building and floor to make navigation efficient.
	query := `
		SELECT 
			o.id, o.order_number, s.short_name, s.mobile_number, 
			o.room_number, o.building, o.floor, o.total_amount, 
			o.status, o.special_instructions, p.status, da.assigned_at, 
			da.delivered_at, da.not_available_flag, da.delivery_notes
		FROM orders o
		JOIN students s ON o.student_id = s.id
		JOIN payments p ON o.id = p.order_id
		JOIN delivery_assignments da ON o.id = da.order_id
		WHERE da.delivery_partner_id = $1 AND o.status IN ('assigned', 'out_for_delivery')
		ORDER BY o.building ASC, o.floor ASC, o.room_number ASC
	`

	rows, err := h.DB.Pool.Query(ctx, query, partnerID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to query assigned orders: "+err.Error())
		return
	}
	defer rows.Close()

	var orders []models.DeliveryOrderView
	for rows.Next() {
		var o models.DeliveryOrderView
		var specialInstr sql.NullString
		var deliveredAt sql.NullTime
		var notes sql.NullString
		var rawPaymentStatus string

		err := rows.Scan(
			&o.ID,
			&o.OrderNumber,
			&o.StudentName,
			&o.StudentPhone,
			&o.RoomNumber,
			&o.Building,
			&o.Floor,
			&o.TotalAmount,
			&o.Status,
			&specialInstr,
			&rawPaymentStatus,
			&o.AssignedAt,
			&deliveredAt,
			&o.NotAvailableFlag,
			&notes,
		)
		if err != nil {
			RespondError(w, http.StatusInternalServerError, "data scan failed: "+err.Error())
			return
		}

		if specialInstr.Valid {
			o.SpecialInstructions = specialInstr.String
		}
		if deliveredAt.Valid {
			o.DeliveredAt = &deliveredAt.Time
		}
		if notes.Valid {
			o.DeliveryNotes = notes.String
		}

		// Simple Payment Status label: Paid vs Unpaid
		if rawPaymentStatus == models.PaymentStatusPaid {
			o.PaymentStatus = "Paid"
		} else {
			o.PaymentStatus = "Unpaid"
		}

		// Load items for this order
		itemQuery := `
			SELECT oi.id, oi.product_id, p.name, oi.quantity, oi.unit_price
			FROM order_items oi
			JOIN products p ON oi.product_id = p.id
			WHERE oi.order_id = $1
		`
		itemRows, err := h.DB.Pool.Query(ctx, itemQuery, o.ID)
		if err == nil {
			var items []models.OrderItem
			for itemRows.Next() {
				var item models.OrderItem
				if err := itemRows.Scan(&item.ID, &item.ProductID, &item.ProductName, &item.Quantity, &item.UnitPrice); err == nil {
					items = append(items, item)
				}
			}
			itemRows.Close()
			o.Items = items
		}

		orders = append(orders, o)
	}

	RespondJSON(w, http.StatusOK, orders)
}

// MarkDelivered records the delivery completion time and updates status history.
func (h *HandlerContext) MarkDelivered(w http.ResponseWriter, r *http.Request) {
	orderID := getRouteParam(r, "id")
	partnerID := r.Context().Value("user_id").(string)
	ctx := r.Context()

	tx, err := h.DB.Pool.Begin(ctx)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to begin transaction")
		return
	}
	defer tx.Rollback(ctx)

	// Verify order is assigned to this partner
	var exists bool
	checkQuery := `SELECT EXISTS(SELECT 1 FROM delivery_assignments WHERE order_id = $1 AND delivery_partner_id = $2)`
	err = tx.QueryRow(ctx, checkQuery, orderID, partnerID).Scan(&exists)
	if err != nil || !exists {
		RespondError(w, http.StatusForbidden, "unauthorized: order not assigned to you")
		return
	}

	// Update order status
	_, err = tx.Exec(ctx, `UPDATE orders SET status = $1 WHERE id = $2`, models.OrderStatusDelivered, orderID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to update order status")
		return
	}

	// Update assignment delivered_at
	_, err = tx.Exec(ctx, `UPDATE delivery_assignments SET delivered_at = $1 WHERE order_id = $2`, time.Now(), orderID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to update delivery assignment record")
		return
	}

	// Add order history
	_, err = tx.Exec(ctx, `INSERT INTO order_status_history (order_id, status, changed_by) VALUES ($1, $2, $3)`, orderID, models.OrderStatusDelivered, partnerID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to save history event")
		return
	}

	err = tx.Commit(ctx)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to commit transaction")
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{"message": "order marked as delivered"})
}

// MarkNotAvailable flags the delivery assignment when student is missing.
func (h *HandlerContext) MarkNotAvailable(w http.ResponseWriter, r *http.Request) {
	orderID := getRouteParam(r, "id")
	partnerID := r.Context().Value("user_id").(string)
	ctx := r.Context()

	query := `
		UPDATE delivery_assignments 
		SET not_available_flag = true 
		WHERE order_id = $1 AND delivery_partner_id = $2
	`
	res, err := h.DB.Pool.Exec(ctx, query, orderID, partnerID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to flag student: "+err.Error())
		return
	}

	if res.RowsAffected() == 0 {
		RespondError(w, http.StatusNotFound, "delivery assignment not found")
		return
	}

	// Write an status history event
	_, _ = h.DB.Pool.Exec(ctx, `INSERT INTO order_status_history (order_id, status, changed_by) VALUES ($1, $2, $3)`, orderID, "customer_not_available", partnerID)

	RespondJSON(w, http.StatusOK, map[string]string{"message": "delivery flagged as student not available"})
}

// UpdateDeliveryNotes adds free-text comments to an active assignment.
func (h *HandlerContext) UpdateDeliveryNotes(w http.ResponseWriter, r *http.Request) {
	orderID := getRouteParam(r, "id")
	partnerID := r.Context().Value("user_id").(string)

	var req UpdateNotesRequest
	if err := jsonNewDecoder(r, &req); err != nil {
		RespondError(w, http.StatusBadRequest, "invalid request")
		return
	}

	ctx := r.Context()
	query := `
		UPDATE delivery_assignments 
		SET delivery_notes = $1 
		WHERE order_id = $2 AND delivery_partner_id = $3
	`
	res, err := h.DB.Pool.Exec(ctx, query, req.Notes, orderID, partnerID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to update notes")
		return
	}

	if res.RowsAffected() == 0 {
		RespondError(w, http.StatusNotFound, "delivery assignment not found")
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{"message": "notes updated successfully"})
}

// GetDeliveryStats counts current shift counts.
func (h *HandlerContext) GetDeliveryStats(w http.ResponseWriter, r *http.Request) {
	partnerID := r.Context().Value("user_id").(string)
	ctx := r.Context()

	var pendingCount int
	var deliveredCount int

	// Count pending orders
	pendingQuery := `
		SELECT COUNT(*) 
		FROM orders o
		JOIN delivery_assignments da ON o.id = da.order_id
		WHERE da.delivery_partner_id = $1 AND o.status IN ('assigned', 'out_for_delivery')
	`
	_ = h.DB.Pool.QueryRow(ctx, pendingQuery, partnerID).Scan(&pendingCount)

	// Count delivered orders today (for current shift)
	todayStart := time.Now().Truncate(24 * time.Hour)
	deliveredQuery := `
		SELECT COUNT(*) 
		FROM delivery_assignments 
		WHERE delivery_partner_id = $1 AND delivered_at >= $2
	`
	_ = h.DB.Pool.QueryRow(ctx, deliveredQuery, partnerID, todayStart).Scan(&deliveredCount)

	RespondJSON(w, http.StatusOK, map[string]int{
		"pending":   pendingCount,
		"delivered": deliveredCount,
	})
}

// GetDeliveryHistory fetches previous delivery events for the partner.
func (h *HandlerContext) GetDeliveryHistory(w http.ResponseWriter, r *http.Request) {
	partnerID := r.Context().Value("user_id").(string)
	ctx := r.Context()

	query := `
		SELECT o.order_number, o.room_number, o.building, o.floor, da.assigned_at, da.delivered_at, da.not_available_flag
		FROM orders o
		JOIN delivery_assignments da ON o.id = da.order_id
		WHERE da.delivery_partner_id = $1 AND o.status = 'delivered'
		ORDER BY da.delivered_at DESC
		LIMIT 50
	`
	rows, err := h.DB.Pool.Query(ctx, query, partnerID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to query history")
		return
	}
	defer rows.Close()

	type HistoryRecord struct {
		OrderNumber      string     `json:"order_number"`
		RoomNumber       string     `json:"room_number"`
		Building         string     `json:"building"`
		Floor            int        `json:"floor"`
		AssignedAt       time.Time  `json:"assigned_at"`
		DeliveredAt      *time.Time `json:"delivered_at"`
		NotAvailableFlag bool       `json:"not_available_flag"`
	}

	var records []HistoryRecord
	for rows.Next() {
		var rec HistoryRecord
		var delTime sql.NullTime
		err = rows.Scan(
			&rec.OrderNumber,
			&rec.RoomNumber,
			&rec.Building,
			&rec.Floor,
			&rec.AssignedAt,
			&delTime,
			&rec.NotAvailableFlag,
		)
		if err == nil {
			if delTime.Valid {
				rec.DeliveredAt = &delTime.Time
			}
			records = append(records, rec)
		}
	}

	RespondJSON(w, http.StatusOK, records)
}
