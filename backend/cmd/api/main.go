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
	customMiddleware "campusbites/backend/internal/middleware"
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

	fcmService, fcmErr := services.NewFCMService(os.Getenv("FIREBASE_CREDENTIALS_FILE"), os.Getenv("FIREBASE_CREDENTIALS_JSON"))
	if fcmErr != nil {
		log.Printf("Firebase FCM Service could not be initialized: %v", fcmErr)
	}

	cloudinaryService := services.NewCloudinaryService(cfg.CloudinaryCloudName, cfg.CloudinaryAPIKey, cfg.CloudinaryAPISecret)

	// 3.5 Setup Queue System
	orderQueue := services.NewOrderQueue(10000, db, paymentService)
	orderQueue.StartWorkers(20)

	hCtx := handlers.NewHandlerContext(db, rdb, authService, ocrService, paymentService, auditService, fcmService, orderQueue, cloudinaryService)

	customMiddleware.SetAllowedOrigins(cfg.AllowedOrigins)

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

		// Run lightweight migrations for new columns
		runMigrations(db)

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

// runMigrations applies additive schema changes that CREATE TABLE IF NOT EXISTS cannot handle.
func runMigrations(db *database.DB) {
	ctx := context.Background()
	migrations := []string{
		"ALTER TABLE students ADD COLUMN IF NOT EXISTS privacy_accepted BOOLEAN DEFAULT FALSE",
		"ALTER TABLE students ADD COLUMN IF NOT EXISTS privacy_accepted_at TIMESTAMP WITH TIME ZONE",
		"ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'out_of_stock'",
		`CREATE TABLE IF NOT EXISTS delivery_slots (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			name VARCHAR(100) NOT NULL,
			delivery_start TIME NOT NULL,
			delivery_end TIME NOT NULL,
			order_cutoff TIME NOT NULL,
			is_active BOOLEAN DEFAULT TRUE,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
		)`,
		"ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_slot_id UUID REFERENCES delivery_slots(id) ON DELETE SET NULL",
		"CREATE INDEX IF NOT EXISTS idx_orders_delivery_slot ON orders(delivery_slot_id)",
		`CREATE TABLE IF NOT EXISTS print_pricing (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			bw_single DECIMAL(10,2) NOT NULL DEFAULT 2.00,
			bw_double DECIMAL(10,2) NOT NULL DEFAULT 3.00,
			color_single DECIMAL(10,2) NOT NULL DEFAULT 8.00,
			color_double DECIMAL(10,2) NOT NULL DEFAULT 10.00,
			updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS print_jobs (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
			file_url TEXT NOT NULL,
			file_name VARCHAR(255) NOT NULL,
			file_type VARCHAR(50) NOT NULL,
			color_mode VARCHAR(10) NOT NULL CHECK (color_mode IN ('bw', 'color')),
			sides VARCHAR(10) NOT NULL CHECK (sides IN ('single', 'double')),
			page_count INT NOT NULL CHECK (page_count > 0),
			copies INT NOT NULL CHECK (copies > 0),
			unit_price DECIMAL(10,2) NOT NULL,
			line_total DECIMAL(10,2) NOT NULL,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
		)`,
		"CREATE INDEX IF NOT EXISTS idx_print_jobs_order ON print_jobs(order_id)",
		`CREATE TABLE IF NOT EXISTS tracking_ad (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
			image_url TEXT NOT NULL DEFAULT '',
			updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
		)`,
	}
	for _, m := range migrations {
		if _, err := db.Pool.Exec(ctx, m); err != nil {
			log.Printf("Migration warning: %v\n", err)
		}
	}
	log.Println("Migrations applied successfully.")
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

	// 3. Seed print pricing if empty
	var pricingCount int
	err = db.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM print_pricing`).Scan(&pricingCount)
	if err == nil && pricingCount == 0 {
		_, err = db.Pool.Exec(ctx, `
			INSERT INTO print_pricing (bw_single, bw_double, color_single, color_double)
			VALUES (2.00, 3.00, 8.00, 10.00)`)
		if err != nil {
			log.Printf("Failed to seed print pricing: %v\n", err)
		} else {
			log.Println("Seeded default print pricing rates.")
		}
	}

	// 4. Seed tracking ad singleton if empty
	var trackingAdCount int
	err = db.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM tracking_ad`).Scan(&trackingAdCount)
	if err == nil && trackingAdCount == 0 {
		_, err = db.Pool.Exec(ctx, `INSERT INTO tracking_ad (is_enabled, image_url) VALUES (FALSE, '')`)
		if err != nil {
			log.Printf("Failed to seed tracking_ad: %v\n", err)
		} else {
			log.Println("Seeded default tracking_ad row.")
		}
	}
}
