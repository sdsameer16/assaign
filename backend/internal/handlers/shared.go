package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	"campusbites/backend/internal/database"
	"campusbites/backend/internal/services"
)

type HandlerContext struct {
	DB             *database.DB
	Redis          *database.RedisDB
	AuthService    *services.AuthService
	OCRService     *services.OCRService
	PaymentService *services.PaymentService
	AuditService   *services.AuditService
	FCMService     *services.FCMService
	OrderQueue     *services.OrderQueue
}

func NewHandlerContext(
	db *database.DB,
	rdb *database.RedisDB,
	auth *services.AuthService,
	ocr *services.OCRService,
	payment *services.PaymentService,
	audit *services.AuditService,
	fcm *services.FCMService,
	orderQueue *services.OrderQueue,
) *HandlerContext {
	return &HandlerContext{
		DB:             db,
		Redis:          rdb,
		AuthService:    auth,
		OCRService:     ocr,
		PaymentService: payment,
		AuditService:   audit,
		FCMService:     fcm,
		OrderQueue:     orderQueue,
	}
}

// RespondJSON marshals data to JSON and writes it with the appropriate HTTP status.
func RespondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if data != nil {
		if err := json.NewEncoder(w).Encode(data); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
	}
}

// RespondError writes a standard error JSON structure to the response.
func RespondError(w http.ResponseWriter, status int, message string) {
	RespondJSON(w, status, map[string]string{"error": message})
}

// getRouteParam extracts route parameters using the Chi router context.
func getRouteParam(r *http.Request, name string) string {
	return chi.URLParam(r, name)
}
