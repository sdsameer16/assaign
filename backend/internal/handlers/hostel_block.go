package handlers

import (
	"net/http"
	"strings"
	"time"

	"campusbites/backend/internal/models"

	"github.com/go-chi/chi/v5"
)

type CreateHostelBlockRequest struct {
	Name         string `json:"name"`
	IsEnabled    *bool  `json:"is_enabled"`
	DisplayOrder int    `json:"display_order"`
}

type UpdateHostelBlockRequest struct {
	Name         string `json:"name"`
	DisplayOrder int    `json:"display_order"`
}

// ListHostelBlocks returns all hostel blocks (public for students & admin management).
func (h *HandlerContext) ListHostelBlocks(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	query := `
		SELECT id, name, is_enabled, display_order, created_at, updated_at
		FROM hostel_blocks
		ORDER BY display_order ASC, name ASC
	`
	rows, err := h.DB.Pool.Query(ctx, query)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to query hostel blocks: "+err.Error())
		return
	}
	defer rows.Close()

	blocks := make([]models.HostelBlock, 0)
	for rows.Next() {
		var b models.HostelBlock
		err := rows.Scan(&b.ID, &b.Name, &b.IsEnabled, &b.DisplayOrder, &b.CreatedAt, &b.UpdatedAt)
		if err != nil {
			RespondError(w, http.StatusInternalServerError, "failed to scan hostel block: "+err.Error())
			return
		}
		blocks = append(blocks, b)
	}

	RespondJSON(w, http.StatusOK, blocks)
}

// CreateHostelBlock creates a new hostel block (Admin only).
func (h *HandlerContext) CreateHostelBlock(w http.ResponseWriter, r *http.Request) {
	var req CreateHostelBlockRequest
	if err := jsonNewDecoder(r, &req); err != nil {
		RespondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		RespondError(w, http.StatusBadRequest, "name is required")
		return
	}

	isEnabled := true
	if req.IsEnabled != nil {
		isEnabled = *req.IsEnabled
	}

	ctx := r.Context()
	var b models.HostelBlock
	query := `
		INSERT INTO hostel_blocks (name, is_enabled, display_order)
		VALUES ($1, $2, $3)
		RETURNING id, name, is_enabled, display_order, created_at, updated_at
	`
	err := h.DB.Pool.QueryRow(ctx, query, req.Name, isEnabled, req.DisplayOrder).Scan(
		&b.ID, &b.Name, &b.IsEnabled, &b.DisplayOrder, &b.CreatedAt, &b.UpdatedAt,
	)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to create hostel block: "+err.Error())
		return
	}

	RespondJSON(w, http.StatusCreated, b)
}

// UpdateHostelBlock updates a hostel block's name and display order (Admin only).
func (h *HandlerContext) UpdateHostelBlock(w http.ResponseWriter, r *http.Request) {
	blockID := chi.URLParam(r, "id")
	if blockID == "" {
		RespondError(w, http.StatusBadRequest, "block id is required")
		return
	}

	var req UpdateHostelBlockRequest
	if err := jsonNewDecoder(r, &req); err != nil {
		RespondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		RespondError(w, http.StatusBadRequest, "name is required")
		return
	}

	ctx := r.Context()
	var b models.HostelBlock
	query := `
		UPDATE hostel_blocks
		SET name = $1, display_order = $2, updated_at = $3
		WHERE id = $4
		RETURNING id, name, is_enabled, display_order, created_at, updated_at
	`
	err := h.DB.Pool.QueryRow(ctx, query, req.Name, req.DisplayOrder, time.Now(), blockID).Scan(
		&b.ID, &b.Name, &b.IsEnabled, &b.DisplayOrder, &b.CreatedAt, &b.UpdatedAt,
	)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to update hostel block: "+err.Error())
		return
	}

	RespondJSON(w, http.StatusOK, b)
}

// ToggleHostelBlock flips the enable/disable status of a hostel block (Admin only).
func (h *HandlerContext) ToggleHostelBlock(w http.ResponseWriter, r *http.Request) {
	blockID := chi.URLParam(r, "id")
	if blockID == "" {
		RespondError(w, http.StatusBadRequest, "block id is required")
		return
	}

	ctx := r.Context()
	var b models.HostelBlock
	query := `
		UPDATE hostel_blocks
		SET is_enabled = NOT is_enabled, updated_at = $1
		WHERE id = $2
		RETURNING id, name, is_enabled, display_order, created_at, updated_at
	`
	err := h.DB.Pool.QueryRow(ctx, query, time.Now(), blockID).Scan(
		&b.ID, &b.Name, &b.IsEnabled, &b.DisplayOrder, &b.CreatedAt, &b.UpdatedAt,
	)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to toggle hostel block status: "+err.Error())
		return
	}

	RespondJSON(w, http.StatusOK, b)
}

// DeleteHostelBlock deletes a hostel block (Admin only).
func (h *HandlerContext) DeleteHostelBlock(w http.ResponseWriter, r *http.Request) {
	blockID := chi.URLParam(r, "id")
	if blockID == "" {
		RespondError(w, http.StatusBadRequest, "block id is required")
		return
	}

	ctx := r.Context()
	_, err := h.DB.Pool.Exec(ctx, `DELETE FROM hostel_blocks WHERE id = $1`, blockID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to delete hostel block: "+err.Error())
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{"message": "hostel block deleted successfully"})
}
