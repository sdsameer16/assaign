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
	
    // Add status column back to orders
	_, err = pool.Exec(context.Background(), "ALTER TABLE orders ADD COLUMN status order_status DEFAULT 'received';")
	if err != nil {
		fmt.Printf("ERROR altering table: %v\n", err)
	} else {
		fmt.Println("Successfully added status column back to orders table!")
	}
}
