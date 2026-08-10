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
	
	rows, err := pool.Query(context.Background(), "SELECT id, mobile_number, short_name, verification_status FROM students")
	if err != nil {
		fmt.Printf("ERROR: %v\n", err)
	} else {
		defer rows.Close()
		count := 0
		for rows.Next() {
			var id, mobile, name, status string
			rows.Scan(&id, &mobile, &name, &status)
			fmt.Printf("Student: %s | %s | %s | %s\n", id, mobile, name, status)
			count++
		}
		fmt.Printf("Total students: %d\n", count)
	}
}
