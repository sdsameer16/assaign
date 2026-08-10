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
	var count int
	err = pool.QueryRow(context.Background(), "SELECT COUNT(*) FROM delivery_config").Scan(&count)
	if err != nil {
		fmt.Printf("ERROR checking delivery_config: %v\n", err)
	} else {
		fmt.Printf("SUCCESS: delivery_config exists and has %d rows\n", count)
	}
}
