package handlers

import (
	"net/http"
	"strings"

	"campusbites/backend/internal/models"
)

type UpdateTrackingAdRequest struct {
	IsEnabled bool   `json:"is_enabled"`
	ImageURL  string `json:"image_url"`
}

func (h *HandlerContext) loadTrackingAd(r *http.Request) (models.TrackingAd, error) {
	var ad models.TrackingAd
	err := h.DB.Pool.QueryRow(r.Context(), `
		SELECT id, is_enabled, image_url, updated_at
		FROM tracking_ad
		ORDER BY updated_at DESC
		LIMIT 1
	`).Scan(&ad.ID, &ad.IsEnabled, &ad.ImageURL, &ad.UpdatedAt)
	return ad, err
}

// GetTrackingAd returns the current tracking advertisement config.
func (h *HandlerContext) GetTrackingAd(w http.ResponseWriter, r *http.Request) {
	ad, err := h.loadTrackingAd(r)
	if err != nil {
		// Soft default when not seeded yet
		RespondJSON(w, http.StatusOK, models.TrackingAd{IsEnabled: false, ImageURL: ""})
		return
	}
	RespondJSON(w, http.StatusOK, ad)
}

// UpdateTrackingAd updates enable flag and Cloudinary image URL.
func (h *HandlerContext) UpdateTrackingAd(w http.ResponseWriter, r *http.Request) {
	adminID := r.Context().Value("user_id").(string)
	var req UpdateTrackingAdRequest
	if err := jsonNewDecoder(r, &req); err != nil {
		RespondError(w, http.StatusBadRequest, "invalid payload")
		return
	}

	req.ImageURL = strings.TrimSpace(req.ImageURL)
	if req.IsEnabled && req.ImageURL == "" {
		RespondError(w, http.StatusBadRequest, "upload an advertisement image before enabling ads")
		return
	}

	ctx := r.Context()
	var ad models.TrackingAd
	err := h.DB.Pool.QueryRow(ctx, `
		UPDATE tracking_ad
		SET is_enabled = $1, image_url = $2, updated_at = NOW()
		WHERE id = (SELECT id FROM tracking_ad ORDER BY updated_at DESC LIMIT 1)
		RETURNING id, is_enabled, image_url, updated_at
	`, req.IsEnabled, req.ImageURL).Scan(&ad.ID, &ad.IsEnabled, &ad.ImageURL, &ad.UpdatedAt)
	if err != nil {
		err = h.DB.Pool.QueryRow(ctx, `
			INSERT INTO tracking_ad (is_enabled, image_url)
			VALUES ($1, $2)
			RETURNING id, is_enabled, image_url, updated_at
		`, req.IsEnabled, req.ImageURL).Scan(&ad.ID, &ad.IsEnabled, &ad.ImageURL, &ad.UpdatedAt)
		if err != nil {
			RespondError(w, http.StatusInternalServerError, "failed to update tracking ad")
			return
		}
	}

	_ = h.AuditService.LogAction(ctx, adminID, "admin", "Updated tracking advertisement", r)
	RespondJSON(w, http.StatusOK, ad)
}
