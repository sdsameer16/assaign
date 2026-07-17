package main

import (
	"context"
	"log"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgresql://neondb_owner:npg_oawN4Uq6JgOj@ep-shy-union-at36y8eu-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
	}
	pool, err := pgxpool.New(context.Background(), dbURL)
	if err != nil {
		log.Fatalf("Unable to connect to database: %v\n", err)
	}
	defer pool.Close()

	var catID string
	err = pool.QueryRow(context.Background(), `
		INSERT INTO categories (name) VALUES ('Load Test Category')
		ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
		RETURNING id`).Scan(&catID)
	if err != nil {
		log.Fatalf("Failed to insert category: %v", err)
	}

	var prodID string
	err = pool.QueryRow(context.Background(), `
		INSERT INTO products (name, category_id, mrp, selling_price, image_url, is_available)
		VALUES ('Load Test Burger', $1, 100.00, 80.00, 'mock', true)
		ON CONFLICT DO NOTHING
		RETURNING id`, catID).Scan(&prodID)
	if err != nil && err.Error() != "no rows in result set" {
		log.Fatalf("Failed to insert product: %v", err)
	}

	log.Println("Successfully seeded test product and category.")
}
