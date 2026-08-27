package handlers

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"campusbites/backend/internal/models"
)

type DeliverySlotRequest struct {
	Name          string `json:"name"`
	DeliveryStart string `json:"delivery_start"`
	DeliveryEnd   string `json:"delivery_end"`
	OrderCutoff   string `json:"order_cutoff"`
	IsActive      *bool  `json:"is_active,omitempty"`
}

type ToggleSlotActiveRequest struct {
	IsActive bool `json:"is_active"`
}

func istNow() time.Time {
	loc, err := time.LoadLocation("Asia/Kolkata")
	if err != nil {
		return time.Now().UTC().Add(5*time.Hour + 30*time.Minute)
	}
	return time.Now().In(loc)
}

// normalizeSlotTime accepts HH:MM or HH:MM AM/PM and returns 24h HH:MM.
func normalizeSlotTime(raw string) (string, error) {
	h, m, err := parseTimeStr(strings.TrimSpace(raw))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%02d:%02d", h, m), nil
}

func validateSlotTimes(start, end, cutoff string) error {
	sh, sm, err := parseTimeStr(start)
	if err != nil {
		return fmt.Errorf("invalid delivery_start")
	}
	eh, em, err := parseTimeStr(end)
	if err != nil {
		return fmt.Errorf("invalid delivery_end")
	}
	ch, cm, err := parseTimeStr(cutoff)
	if err != nil {
		return fmt.Errorf("invalid order_cutoff")
	}
	startMin := sh*60 + sm
	endMin := eh*60 + em
	cutoffMin := ch*60 + cm
	if startMin >= endMin {
		return fmt.Errorf("delivery_start must be before delivery_end")
	}
	if cutoffMin >= startMin {
		return fmt.Errorf("order_cutoff must be before delivery_start")
	}
	return nil
}

func (h *HandlerContext) checkSlotTimeOverlap(ctx context.Context, start, end, excludeID string) error {
	query := `
		SELECT name, TO_CHAR(delivery_start, 'HH24:MI'), TO_CHAR(delivery_end, 'HH24:MI')
		FROM delivery_slots
		WHERE is_active = true
	`
	args := []interface{}{}
	if excludeID != "" {
		query += " AND id != $1"
		args = append(args, excludeID)
	}

	rows, err := h.DB.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil
	}
	defer rows.Close()

	sh, sm, _ := parseTimeStr(start)
	eh, em, _ := parseTimeStr(end)
	newStart := sh*60 + sm
	newEnd := eh*60 + em

	for rows.Next() {
		var name, dStart, dEnd string
		if err := rows.Scan(&name, &dStart, &dEnd); err != nil {
			continue
		}
		eSh, eSm, _ := parseTimeStr(dStart)
		eEh, eEm, _ := parseTimeStr(dEnd)
		exStart := eSh*60 + eSm
		exEnd := eEh*60 + eEm

		if newStart < exEnd && newEnd > exStart {
			return fmt.Errorf("delivery window (%s - %s) overlaps with existing slot '%s' (%s - %s)", start, end, name, dStart, dEnd)
		}
	}
	return nil
}

func isSlotOrderingOpen(orderCutoff string, now time.Time) bool {
	ch, cm, err := parseTimeStr(orderCutoff)
	if err != nil {
		return false
	}
	cutoff := time.Date(now.Year(), now.Month(), now.Day(), ch, cm, 0, 0, now.Location())
	return !now.After(cutoff)
}

func scanDeliverySlot(id, name, start, end, cutoff string, active bool, createdAt, updatedAt time.Time, now time.Time) models.DeliverySlot {
	slot := models.DeliverySlot{
		ID:             id,
		Name:           name,
		DeliveryStart:  start,
		DeliveryEnd:    end,
		OrderCutoff:    cutoff,
		IsActive:       active,
		IsOrderingOpen: active && isSlotOrderingOpen(cutoff, now),
		CreatedAt:      createdAt,
		UpdatedAt:      updatedAt,
	}
	return slot
}

func (h *HandlerContext) listDeliverySlots(ctx context.Context, activeOnly bool) ([]models.DeliverySlot, error) {
	query := `
		SELECT id, name,
		       TO_CHAR(delivery_start, 'HH24:MI'),
		       TO_CHAR(delivery_end, 'HH24:MI'),
		       TO_CHAR(order_cutoff, 'HH24:MI'),
		       is_active, created_at, updated_at
		FROM delivery_slots
	`
	if activeOnly {
		query += ` WHERE is_active = true`
	}
	query += ` ORDER BY delivery_start ASC`

	rows, err := h.DB.Pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	now := istNow()
	list := []models.DeliverySlot{}
	for rows.Next() {
		var id, name, start, end, cutoff string
		var active bool
		var createdAt, updatedAt time.Time
		if err := rows.Scan(&id, &name, &start, &end, &cutoff, &active, &createdAt, &updatedAt); err != nil {
			continue
		}
		list = append(list, scanDeliverySlot(id, name, start, end, cutoff, active, createdAt, updatedAt, now))
	}
	return list, nil
}

// ListDeliverySlots returns all slots for admin management.
func (h *HandlerContext) ListDeliverySlots(w http.ResponseWriter, r *http.Request) {
	list, err := h.listDeliverySlots(r.Context(), false)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to list delivery slots")
		return
	}
	RespondJSON(w, http.StatusOK, list)
}

// StudentListDeliverySlots returns active recurring slots with live availability.
func (h *HandlerContext) StudentListDeliverySlots(w http.ResponseWriter, r *http.Request) {
	list, err := h.listDeliverySlots(r.Context(), true)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to list delivery slots")
		return
	}
	RespondJSON(w, http.StatusOK, list)
}

// CreateDeliverySlot creates a recurring daily slot.
func (h *HandlerContext) CreateDeliverySlot(w http.ResponseWriter, r *http.Request) {
	adminID := r.Context().Value("user_id").(string)
	var req DeliverySlotRequest
	if err := jsonNewDecoder(r, &req); err != nil {
		RespondError(w, http.StatusBadRequest, "invalid payload")
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		RespondError(w, http.StatusBadRequest, "slot name is required")
		return
	}
	start, err := normalizeSlotTime(req.DeliveryStart)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "invalid delivery_start; use HH:MM")
		return
	}
	end, err := normalizeSlotTime(req.DeliveryEnd)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "invalid delivery_end; use HH:MM")
		return
	}
	cutoff, err := normalizeSlotTime(req.OrderCutoff)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "invalid order_cutoff; use HH:MM")
		return
	}
	if err := validateSlotTimes(start, end, cutoff); err != nil {
		RespondError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := h.checkSlotTimeOverlap(r.Context(), start, end, ""); err != nil {
		RespondError(w, http.StatusBadRequest, err.Error())
		return
	}

	active := true
	if req.IsActive != nil {
		active = *req.IsActive
	}

	ctx := r.Context()
	var id string
	var createdAt, updatedAt time.Time
	err = h.DB.Pool.QueryRow(ctx, `
		INSERT INTO delivery_slots (name, delivery_start, delivery_end, order_cutoff, is_active)
		VALUES ($1, $2::time, $3::time, $4::time, $5)
		RETURNING id, created_at, updated_at
	`, name, start, end, cutoff, active).Scan(&id, &createdAt, &updatedAt)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to create delivery slot")
		return
	}

	_ = h.AuditService.LogAction(ctx, adminID, "admin", "Created delivery slot: "+name, r)
	RespondJSON(w, http.StatusCreated, scanDeliverySlot(id, name, start, end, cutoff, active, createdAt, updatedAt, istNow()))
}

// UpdateDeliverySlot updates a recurring daily slot.
func (h *HandlerContext) UpdateDeliverySlot(w http.ResponseWriter, r *http.Request) {
	adminID := r.Context().Value("user_id").(string)
	slotID := chi.URLParam(r, "id")
	if slotID == "" {
		RespondError(w, http.StatusBadRequest, "missing slot id")
		return
	}

	var req DeliverySlotRequest
	if err := jsonNewDecoder(r, &req); err != nil {
		RespondError(w, http.StatusBadRequest, "invalid payload")
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		RespondError(w, http.StatusBadRequest, "slot name is required")
		return
	}
	start, err := normalizeSlotTime(req.DeliveryStart)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "invalid delivery_start; use HH:MM")
		return
	}
	end, err := normalizeSlotTime(req.DeliveryEnd)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "invalid delivery_end; use HH:MM")
		return
	}
	cutoff, err := normalizeSlotTime(req.OrderCutoff)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "invalid order_cutoff; use HH:MM")
		return
	}
	if err := validateSlotTimes(start, end, cutoff); err != nil {
		RespondError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := h.checkSlotTimeOverlap(r.Context(), start, end, slotID); err != nil {
		RespondError(w, http.StatusBadRequest, err.Error())
		return
	}

	ctx := r.Context()
	var active bool
	var createdAt, updatedAt time.Time
	var err2 error
	if req.IsActive != nil {
		err2 = h.DB.Pool.QueryRow(ctx, `
			UPDATE delivery_slots
			SET name = $1,
			    delivery_start = $2::time,
			    delivery_end = $3::time,
			    order_cutoff = $4::time,
			    is_active = $5,
			    updated_at = NOW()
			WHERE id = $6
			RETURNING is_active, created_at, updated_at
		`, name, start, end, cutoff, *req.IsActive, slotID).Scan(&active, &createdAt, &updatedAt)
	} else {
		err2 = h.DB.Pool.QueryRow(ctx, `
			UPDATE delivery_slots
			SET name = $1,
			    delivery_start = $2::time,
			    delivery_end = $3::time,
			    order_cutoff = $4::time,
			    updated_at = NOW()
			WHERE id = $5
			RETURNING is_active, created_at, updated_at
		`, name, start, end, cutoff, slotID).Scan(&active, &createdAt, &updatedAt)
	}
	if err2 != nil {
		RespondError(w, http.StatusNotFound, "delivery slot not found")
		return
	}

	_ = h.AuditService.LogAction(ctx, adminID, "admin", "Updated delivery slot: "+name, r)
	RespondJSON(w, http.StatusOK, scanDeliverySlot(slotID, name, start, end, cutoff, active, createdAt, updatedAt, istNow()))
}

// ToggleDeliverySlotActive activates or deactivates a slot.
func (h *HandlerContext) ToggleDeliverySlotActive(w http.ResponseWriter, r *http.Request) {
	adminID := r.Context().Value("user_id").(string)
	slotID := chi.URLParam(r, "id")
	if slotID == "" {
		RespondError(w, http.StatusBadRequest, "missing slot id")
		return
	}

	var req ToggleSlotActiveRequest
	if err := jsonNewDecoder(r, &req); err != nil {
		RespondError(w, http.StatusBadRequest, "invalid payload")
		return
	}

	ctx := r.Context()
	var id, name, start, end, cutoff string
	var active bool
	var createdAt, updatedAt time.Time
	err := h.DB.Pool.QueryRow(ctx, `
		UPDATE delivery_slots
		SET is_active = $1, updated_at = NOW()
		WHERE id = $2
		RETURNING id, name,
		          TO_CHAR(delivery_start, 'HH24:MI'),
		          TO_CHAR(delivery_end, 'HH24:MI'),
		          TO_CHAR(order_cutoff, 'HH24:MI'),
		          is_active, created_at, updated_at
	`, req.IsActive, slotID).Scan(&id, &name, &start, &end, &cutoff, &active, &createdAt, &updatedAt)
	if err != nil {
		RespondError(w, http.StatusNotFound, "delivery slot not found")
		return
	}

	action := "Deactivated"
	if active {
		action = "Activated"
	}
	_ = h.AuditService.LogAction(ctx, adminID, "admin", action+" delivery slot: "+name, r)
	RespondJSON(w, http.StatusOK, scanDeliverySlot(id, name, start, end, cutoff, active, createdAt, updatedAt, istNow()))
}
