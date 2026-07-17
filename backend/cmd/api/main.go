package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"campusbites/backend/internal/config"
	"campusbites/backend/internal/database"
	"campusbites/backend/internal/handlers"
	"campusbites/backend/internal/server"
	"campusbites/backend/internal/services"
)

func main() {
	log.Println("Starting CampusBites Go Backend Service...")

	// 1. Load Configurations
	cfg := config.LoadConfig()

	// 2. Connect Database
	var db *database.DB
	var err error
	if cfg.DatabaseURL != "" {
		db, err = database.ConnectDB(cfg.DatabaseURL)
		if err != nil {
			log.Printf("CRITICAL DATABASE ERROR: %v\n", err)
			log.Println("Backend will proceed, but DB-dependent API queries will fail. Make sure PostgreSQL is running.")
		}
	} else {
		log.Println("WARNING: DATABASE_URL not configured. Running database-less mock mode is not supported by pgx.")
	}

	// 2b. Connect Redis
	var rdb *database.RedisDB
	if cfg.RedisAddr != "" {
		rdb, err = database.ConnectRedis(cfg.RedisAddr, cfg.RedisUsername, cfg.RedisPassword, cfg.RedisUseTLS)
		if err != nil {
			log.Printf("REDIS CONNECTION ERROR: %v\n", err)
			log.Println("Backend will proceed, but Redis checks will fail. Check configuration.")
		} else {
			defer rdb.Close()
			// Run the diagnostic Set/Get query requested
			err = rdb.TestSetGet("student", "Sameer")
			if err != nil {
				log.Printf("Redis diagnostic Set/Get test failed: %v\n", err)
			}
		}
	}

	// 3. Initialize services
	authService := services.NewAuthService(cfg.JWTSecret, cfg.JWTExpiryHours)
	ocrService := services.NewOCRService(cfg.OCRProvider, cfg.OCRApiKey)
	paymentService := services.NewPaymentService(cfg.RazorpayKeyID, cfg.RazorpayKeySecret, cfg.RazorpayWebhookSecret)
	auditService := services.NewAuditService(db)

	fcmService, fcmErr := services.NewFCMService(os.Getenv("FIREBASE_CREDENTIALS_FILE"))
	if fcmErr != nil {
		log.Printf("Firebase FCM Service could not be initialized: %v", fcmErr)
	}

	// 3.5 Setup Queue System
	orderQueue := services.NewOrderQueue(10000, db, paymentService)
	orderQueue.StartWorkers(20)

	hCtx := handlers.NewHandlerContext(db, rdb, authService, ocrService, paymentService, auditService, fcmService, orderQueue)

	// 4. Bootstrap database tables and run seeding if database is connected
	if db != nil {
		// Look for schema.sql in parent backend folder
		schemaPath := "schema.sql"
		if _, err := os.Stat(schemaPath); os.IsNotExist(err) {
			// Try directory relative pathing if run from root
			schemaPath = filepath.Join("backend", "schema.sql")
		}

		if _, err := os.Stat(schemaPath); err == nil {
			log.Printf("Found schema file at %s. Ensuring tables are initialized...\n", schemaPath)
			err = db.InitializeSchema(schemaPath)
			if err != nil {
				log.Printf("Database schema initialization warning (might already exist): %v\n", err)
			}
		}

		// Seed initial datasets if empty
		seedDatabase(db, authService)
	}

	// 5. Initialize Router
	router := server.NewRouter(hCtx)

	// 6. Listen and Serve
	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("API gateway listening on HTTP port %s in %s mode\n", cfg.Port, cfg.Env)

	srv := &http.Server{
		Handler:      router,
		Addr:         addr,
		WriteTimeout: 15 * time.Second,
		ReadTimeout:  15 * time.Second,
	}

	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Server listen failed: %v", err)
	}
}

// seedDatabase seeds the database with categories, products, and a default admin user.
func seedDatabase(db *database.DB, authService *services.AuthService) {
	ctx := context.Background()

	// 1. Seed admin user if 0 exist
	var adminCount int
	err := db.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM admin_users`).Scan(&adminCount)
	if err == nil && adminCount == 0 {
		hash, err := authService.HashPassword("Admin&Ayaz786")
		if err == nil {
			_, err = db.Pool.Exec(ctx, `
				INSERT INTO admin_users (name, email, password_hash, role)
				VALUES ($1, $2, $3, 'super_admin')`,
				"System Administrator", "admin@campusbites.com", hash,
			)
			if err != nil {
				log.Printf("Failed to seed default admin: %v\n", err)
			} else {
				log.Println("Seeded Default Admin User: admin@campusbites.com / Admin&Ayaz786")
			}
		}
	} else if err == nil && adminCount > 0 {
		// Update password hash for default admin to ensure password change
		hash, err := authService.HashPassword("Admin&Ayaz786")
		if err == nil {
			_, err = db.Pool.Exec(ctx, `
				UPDATE admin_users 
				SET password_hash = $1 
				WHERE email = 'admin@campusbites.com'`,
				hash,
			)
			if err != nil {
				log.Printf("Failed to update default admin password: %v\n", err)
			} else {
				log.Println("Updated Default Admin User password to: Admin&Ayaz786")
			}
		}
	}

	// 2. Seed categories and products if empty
	var catCount int
	err = db.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM categories`).Scan(&catCount)
	if err == nil && catCount == 0 {
		// Insert Categories
		categories := []string{"Snacks", "Beverages", "Meals"}
		catIDs := make(map[string]string)

		for _, name := range categories {
			var id string
			err = db.Pool.QueryRow(ctx, `INSERT INTO categories (name) VALUES ($1) RETURNING id`, name).Scan(&id)
			if err == nil {
				catIDs[name] = id
			}
		}

		// Insert Products
		products := []struct {
			name        string
			category    string
			mrp         float64
			price       float64
			imageUrl    string
			isAvailable bool
		}{
			{"Crispy Samosa", "Snacks", 15.00, 12.00, "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?w=300", true},
			{"Veg Burger Combo", "Meals", 120.00, 99.00, "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300", true},
			{"Masala Tea", "Beverages", 12.00, 10.00, "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=300", true},
			{"Cold Coffee", "Beverages", 45.00, 39.00, "https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=300", true},
			{"French Fries", "Snacks", 60.00, 49.00, "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=300", true},
		}

		for _, p := range products {
			catID, ok := catIDs[p.category]
			if ok {
				_, err = db.Pool.Exec(ctx, `
					INSERT INTO products (name, category_id, mrp, selling_price, image_url, is_available)
					VALUES ($1, $2, $3, $4, $5, $6)`,
					p.name, catID, p.mrp, p.price, p.imageUrl, p.isAvailable,
				)
				if err != nil {
					log.Printf("Failed to seed product %s: %v\n", p.name, err)
				}
			}
		}
		log.Println("Seeded default food menu categories and products successfully.")
	}
}
