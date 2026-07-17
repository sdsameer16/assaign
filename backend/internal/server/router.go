package server

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"campusbites/backend/internal/handlers"
	customMiddleware "campusbites/backend/internal/middleware"
)

func NewRouter(hCtx *handlers.HandlerContext) http.Handler {
	r := chi.NewRouter()

	// Global Middlewares
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(customMiddleware.CORSMiddleware)

	// API Namespace Group
	r.Route("/api", func(r chi.Router) {

		// 1. Student Portal API Group
		r.Route("/student", func(r chi.Router) {
			r.Post("/register", hCtx.StudentRegister)
			r.Post("/login", hCtx.StudentLogin)
			r.Get("/menu", hCtx.GetMenu)
			r.Get("/cutoff", hCtx.GetCutoffTime)

			// Authenticated Student Endpoints
			r.Group(func(r chi.Router) {
				r.Use(customMiddleware.AuthMiddleware(hCtx.AuthService))
				r.Use(customMiddleware.RequireRole("student"))

				r.Post("/orders", hCtx.StudentCreateOrder)
				r.Get("/orders/{id}/track", hCtx.TrackOrder)
				r.Get("/orders/history", hCtx.StudentGetHistory)
				r.Post("/payments/verify", hCtx.StudentVerifyPayment)
			})
		})

		// 2. Admin Dashboard API Group
		r.Route("/admin", func(r chi.Router) {
			r.Post("/login", hCtx.AdminLogin)

			// Authenticated Admin Endpoints
			r.Group(func(r chi.Router) {
				r.Use(customMiddleware.AuthMiddleware(hCtx.AuthService))
				r.Use(customMiddleware.RequireRole("admin"))

				r.Get("/dashboard/summary", hCtx.GetDashboardSummary)
				r.Get("/products", hCtx.ListProducts)
				r.Post("/products", hCtx.CreateProduct)
				r.Put("/products/{id}", hCtx.UpdateProduct)
				r.Get("/students", hCtx.GetStudents)
				r.Patch("/students/{id}/verify", hCtx.UpdateStudentVerification)
				r.Get("/delivery-partners", hCtx.GetDeliveryPartners)
				r.Post("/delivery-partners", hCtx.CreateDeliveryPartner)
				r.Post("/orders/{id}/assign", hCtx.AssignDeliveryPartner)
				r.Post("/orders/{id}/cancel", hCtx.CancelOrder)
				r.Post("/orders/{id}/deliver", hCtx.DeliverOrder)
				r.Get("/orders", hCtx.AdminGetOrders)
				r.Get("/audit-logs", hCtx.GetAuditLogs)
				r.Get("/cutoff", hCtx.GetCutoffTime)
				r.Post("/cutoff", hCtx.SetCutoffTime)
			})
		})

		// 3. Delivery Partner App API Group
		r.Route("/delivery", func(r chi.Router) {
			r.Post("/login", hCtx.DeliveryLogin)

			// Authenticated Delivery Endpoints
			r.Group(func(r chi.Router) {
				r.Use(customMiddleware.AuthMiddleware(hCtx.AuthService))
				r.Use(customMiddleware.RequireRole("delivery"))

				r.Get("/orders", hCtx.GetAssignedOrders)
				r.Patch("/orders/{id}/delivered", hCtx.MarkDelivered)
				r.Patch("/orders/{id}/not-available", hCtx.MarkNotAvailable)
				r.Patch("/orders/{id}/notes", hCtx.UpdateDeliveryNotes)
				r.Get("/stats", hCtx.GetDeliveryStats)
				r.Get("/history", hCtx.GetDeliveryHistory)
			})
		})
	})

	return r
}
