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
	
	// Check if delivery_config exists
	var count int
	err = pool.QueryRow(context.Background(), "SELECT COUNT(*) FROM delivery_config").Scan(&count)
	if err != nil {
		fmt.Printf("ERROR checking delivery_config: %v\n", err)
	} else {
		fmt.Printf("SUCCESS: delivery_config exists and has %d rows\n", count)
	}

    // List columns of orders table
	rows, err := pool.Query(context.Background(), "SELECT column_name FROM information_schema.columns WHERE table_name = 'orders'")
	if err != nil {
		fmt.Printf("ERROR listing orders columns: %v\n", err)
	} else {
		defer rows.Close()
        fmt.Print("Columns in orders table: ")
		for rows.Next() {
			var col string
			rows.Scan(&col)
			fmt.Printf("%s, ", col)
		}
		fmt.Println()
	}
}
