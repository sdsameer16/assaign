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

		// Razorpay webhooks (public; signature-verified)
		r.Post("/payments/webhook", hCtx.RazorpayWebhook)

		// 1. Student Portal API Group
		r.Route("/student", func(r chi.Router) {
			r.Post("/upload", hCtx.StudentUploadFile)
			r.Post("/register", hCtx.StudentRegister)
			r.Post("/login", hCtx.StudentLogin)
			r.Post("/ocr/preview", hCtx.StudentOCRPreview)
			r.Get("/menu", hCtx.GetMenu)
			r.Get("/cutoff", hCtx.GetCutoffTime)
			r.Get("/delivery-slots", hCtx.StudentListDeliverySlots)
			r.Get("/delivery-config", hCtx.GetDeliveryConfig)
			r.Get("/print-pricing", hCtx.GetPrintPricing)
			r.Get("/tracking-ad", hCtx.GetTrackingAd)
			r.Get("/menu-schedules", hCtx.GetActiveMenuSchedules)
			r.Get("/hostel-blocks", hCtx.ListHostelBlocks)

			// Authenticated Student Endpoints

			r.Group(func(r chi.Router) {
				r.Use(customMiddleware.AuthMiddleware(hCtx.AuthService))
				r.Use(customMiddleware.RequireRole("student"))

				r.Get("/privacy", hCtx.GetPrivacyStatus)
				r.Post("/privacy/accept", hCtx.AcceptPrivacy)
				r.Get("/cart", hCtx.GetCart)
				r.Post("/cart", hCtx.UpdateCart)
				r.Post("/cart/merge", hCtx.MergeCart)
				r.Post("/orders", hCtx.StudentCreateOrder)

				r.Get("/orders/history", hCtx.StudentGetHistory)
				r.Get("/orders/{id}/track", hCtx.TrackOrder)
				r.Post("/orders/{id}/review", hCtx.CreateOrderReview)
				r.Get("/orders/{id}/payment-status", hCtx.GetPaymentStatus)
				r.Post("/orders/{id}/cancel-unpaid", hCtx.CancelUnpaidOrder)
				r.Post("/payments/verify", hCtx.StudentVerifyPayment)
				r.Post("/fcm-token", hCtx.SaveStudentFCMToken)
			})
		})

		// 2. Admin Dashboard API Group
		r.Route("/admin", func(r chi.Router) {
			r.Post("/login", hCtx.AdminLogin)

			// Authenticated Admin Endpoints
			r.Group(func(r chi.Router) {
				r.Use(customMiddleware.AuthMiddleware(hCtx.AuthService))
				r.Use(customMiddleware.RequireRole("admin"))

				r.Post("/upload", hCtx.StudentUploadFile)
				r.Get("/dashboard/summary", hCtx.GetDashboardSummary)
				r.Get("/categories", hCtx.ListCategories)
				r.Post("/categories", hCtx.CreateCategory)
				r.Get("/products", hCtx.ListProducts)
				r.Post("/products", hCtx.CreateProduct)
				r.Put("/products/{id}", hCtx.UpdateProduct)
				r.Get("/students", hCtx.GetStudents)
				r.Patch("/students/{id}/verify", hCtx.UpdateStudentVerification)
				r.Get("/delivery-partners", hCtx.GetDeliveryPartners)
				r.Post("/delivery-partners", hCtx.CreateDeliveryPartner)
				r.Post("/orders/{id}/assign", hCtx.AssignDeliveryPartner)
				r.Post("/orders/{id}/out-of-stock", hCtx.MarkOrderOutOfStock)
				r.Post("/orders/{id}/cancel", hCtx.CancelOrder)
				r.Post("/orders/{id}/deliver", hCtx.DeliverOrder)
				r.Get("/orders", hCtx.AdminGetOrders)
				r.Get("/audit-logs", hCtx.GetAuditLogs)
				r.Get("/cutoff", hCtx.GetCutoffTime)
				r.Post("/cutoff", hCtx.SetCutoffTime)
				r.Get("/delivery-slots", hCtx.ListDeliverySlots)
				r.Post("/delivery-slots", hCtx.CreateDeliverySlot)
				r.Put("/delivery-slots/{id}", hCtx.UpdateDeliverySlot)
				r.Patch("/delivery-slots/{id}/active", hCtx.ToggleDeliverySlotActive)
				r.Get("/delivery-config", hCtx.GetDeliveryConfig)
				r.Put("/delivery-config", hCtx.UpdateDeliveryConfig)
				r.Get("/print-pricing", hCtx.GetPrintPricing)
				r.Put("/print-pricing", hCtx.UpdatePrintPricing)
				r.Get("/tracking-ad", hCtx.GetTrackingAd)
				r.Put("/tracking-ad", hCtx.UpdateTrackingAd)
				r.Get("/menu-schedules", hCtx.ListMenuSchedules)
				r.Post("/menu-schedules", hCtx.CreateMenuSchedule)
				r.Put("/menu-schedules/{id}", hCtx.UpdateMenuSchedule)
				r.Delete("/menu-schedules/{id}", hCtx.DeleteMenuSchedule)
				r.Post("/send-notification", hCtx.AdminSendNotification)
				r.Get("/payments/health", hCtx.AdminGetPaymentHealth)
				r.Post("/payments/{id}/reconcile", hCtx.AdminReconcilePayment)
				r.Get("/hostel-blocks", hCtx.ListHostelBlocks)
				r.Post("/hostel-blocks", hCtx.CreateHostelBlock)
				r.Put("/hostel-blocks/{id}", hCtx.UpdateHostelBlock)
				r.Patch("/hostel-blocks/{id}/toggle", hCtx.ToggleHostelBlock)
				r.Delete("/hostel-blocks/{id}", hCtx.DeleteHostelBlock)
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
