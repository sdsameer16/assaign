//go:build ignore

package main
import (
	"context"
	"fmt"
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
		log.Fatal(err)
	}
	defer pool.Close()
	
	query := `CREATE TABLE IF NOT EXISTS delivery_config (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 15.00,
        min_free_delivery_amount DECIMAL(10,2) NOT NULL DEFAULT 100.00,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );`
	_, err = pool.Exec(context.Background(), query)
	if err != nil {
		fmt.Printf("ERROR: %v\n", err)
	} else {
		fmt.Println("SUCCESS: delivery_config created")
	}
}
