package handlers

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"strings"

	"campusbites/backend/internal/models"
)

type UpdatePrintPricingRequest struct {
	BWSingle    float64 `json:"bw_single"`
	BWDouble    float64 `json:"bw_double"`
	ColorSingle float64 `json:"color_single"`
	ColorDouble float64 `json:"color_double"`
}

type PrintJobRequest struct {
	FileURL   string `json:"file_url"`
	FileName  string `json:"file_name"`
	FileType  string `json:"file_type"`
	ColorMode string `json:"color_mode"`
	Sides     string `json:"sides"`
	PageCount int    `json:"page_count"`
	Copies    int    `json:"copies"`
}

func (h *HandlerContext) loadPrintPricing(ctx context.Context) (models.PrintPricing, error) {
	var p models.PrintPricing
	err := h.DB.Pool.QueryRow(ctx, `
		SELECT id, bw_single, bw_double, color_single, color_double, updated_at
		FROM print_pricing
		ORDER BY updated_at DESC
		LIMIT 1
	`).Scan(&p.ID, &p.BWSingle, &p.BWDouble, &p.ColorSingle, &p.ColorDouble, &p.UpdatedAt)
	return p, err
}

func rateForPrintJob(pricing models.PrintPricing, colorMode, sides string) (float64, error) {
	switch strings.ToLower(colorMode) {
	case "bw":
		if sides == "double" {
			return pricing.BWDouble, nil
		}
		if sides == "single" {
			return pricing.BWSingle, nil
		}
	case "color":
		if sides == "double" {
			return pricing.ColorDouble, nil
		}
		if sides == "single" {
			return pricing.ColorSingle, nil
		}
	}
	return 0, fmt.Errorf("invalid color_mode/sides")
}

func validatePrintJobRequest(job PrintJobRequest) error {
	if strings.TrimSpace(job.FileURL) == "" {
		return fmt.Errorf("file_url is required")
	}
	if strings.TrimSpace(job.FileName) == "" {
		return fmt.Errorf("file_name is required")
	}
	mode := strings.ToLower(strings.TrimSpace(job.ColorMode))
	if mode != "bw" && mode != "color" {
		return fmt.Errorf("color_mode must be bw or color")
	}
	sides := strings.ToLower(strings.TrimSpace(job.Sides))
	if sides != "single" && sides != "double" {
		return fmt.Errorf("sides must be single or double")
	}
	if job.PageCount <= 0 {
		return fmt.Errorf("page_count must be greater than zero")
	}
	if job.Copies <= 0 {
		return fmt.Errorf("copies must be greater than zero")
	}
	return nil
}

func (h *HandlerContext) loadPrintJobsForOrder(ctx context.Context, orderID string) []models.PrintJob {
	rows, err := h.DB.Pool.Query(ctx, `
		SELECT id, order_id, file_url, file_name, file_type, color_mode, sides,
		       page_count, copies, unit_price, line_total
		FROM print_jobs WHERE order_id = $1 ORDER BY created_at ASC
	`, orderID)
	if err != nil {
		return make([]models.PrintJob, 0)
	}
	defer rows.Close()

	jobs := make([]models.PrintJob, 0)
	for rows.Next() {
		var j models.PrintJob
		if err := rows.Scan(
			&j.ID, &j.OrderID, &j.FileURL, &j.FileName, &j.FileType, &j.ColorMode, &j.Sides,
			&j.PageCount, &j.Copies, &j.UnitPrice, &j.LineTotal,
		); err == nil {
			jobs = append(jobs, j)
		}
	}
	return jobs
}

func printJobsSummary(jobs []models.PrintJob) string {
	if len(jobs) == 0 {
		return ""
	}
	parts := make([]string, 0, len(jobs))
	for _, j := range jobs {
		parts = append(parts, fmt.Sprintf("%s (%s %s, %dp ×%d)", j.FileName, j.ColorMode, j.Sides, j.PageCount, j.Copies))
	}
	return fmt.Sprintf("%d print job(s): %s", len(jobs), strings.Join(parts, "; "))
}

// cleanupPrintFilesForOrder deletes Cloudinary assets for an order after delivery
// and clears stored file URLs so they can no longer be downloaded.
func (h *HandlerContext) cleanupPrintFilesForOrder(ctx context.Context, orderID string) {
	jobs := h.loadPrintJobsForOrder(ctx, orderID)
	if len(jobs) == 0 {
		return
	}

	for _, job := range jobs {
		if strings.TrimSpace(job.FileURL) == "" {
			continue
		}
		if h.CloudinaryService == nil {
			log.Printf("skip cloudinary delete for print job %s: service not configured", job.ID)
			continue
		}
		if err := h.CloudinaryService.DeleteByURL(job.FileURL); err != nil {
			log.Printf("failed to delete print file for job %s: %v", job.ID, err)
			continue
		}
		_, err := h.DB.Pool.Exec(ctx, `UPDATE print_jobs SET file_url = '' WHERE id = $1`, job.ID)
		if err != nil {
			log.Printf("failed to clear print job url %s: %v", job.ID, err)
		}
	}
}

// GetPrintPricing returns current per-page print rates (student/admin).
func (h *HandlerContext) GetPrintPricing(w http.ResponseWriter, r *http.Request) {
	pricing, err := h.loadPrintPricing(r.Context())
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "print pricing not configured")
		return
	}
	RespondJSON(w, http.StatusOK, pricing)
}

// UpdatePrintPricing updates the singleton print rates.
func (h *HandlerContext) UpdatePrintPricing(w http.ResponseWriter, r *http.Request) {
	adminID := r.Context().Value("user_id").(string)
	var req UpdatePrintPricingRequest
	if err := jsonNewDecoder(r, &req); err != nil {
		RespondError(w, http.StatusBadRequest, "invalid payload")
		return
	}
	if req.BWSingle <= 0 || req.BWDouble <= 0 || req.ColorSingle <= 0 || req.ColorDouble <= 0 {
		RespondError(w, http.StatusBadRequest, "all rates must be greater than zero")
		return
	}

	ctx := r.Context()
	var pricing models.PrintPricing
	err := h.DB.Pool.QueryRow(ctx, `
		UPDATE print_pricing
		SET bw_single = $1, bw_double = $2, color_single = $3, color_double = $4, updated_at = NOW()
		WHERE id = (SELECT id FROM print_pricing ORDER BY updated_at DESC LIMIT 1)
		RETURNING id, bw_single, bw_double, color_single, color_double, updated_at
	`, req.BWSingle, req.BWDouble, req.ColorSingle, req.ColorDouble).Scan(
		&pricing.ID, &pricing.BWSingle, &pricing.BWDouble, &pricing.ColorSingle, &pricing.ColorDouble, &pricing.UpdatedAt,
	)
	if err != nil {
		// Insert if none exists
		err = h.DB.Pool.QueryRow(ctx, `
			INSERT INTO print_pricing (bw_single, bw_double, color_single, color_double)
			VALUES ($1, $2, $3, $4)
			RETURNING id, bw_single, bw_double, color_single, color_double, updated_at
		`, req.BWSingle, req.BWDouble, req.ColorSingle, req.ColorDouble).Scan(
			&pricing.ID, &pricing.BWSingle, &pricing.BWDouble, &pricing.ColorSingle, &pricing.ColorDouble, &pricing.UpdatedAt,
		)
		if err != nil {
			RespondError(w, http.StatusInternalServerError, "failed to update print pricing")
			return
		}
	}

	_ = h.AuditService.LogAction(ctx, adminID, "admin", "Updated print pricing", r)
	RespondJSON(w, http.StatusOK, pricing)
}
