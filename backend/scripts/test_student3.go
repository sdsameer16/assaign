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
	
    // Check if student_documents exists
	rows, err := pool.Query(context.Background(), "SELECT column_name FROM information_schema.columns WHERE table_name = 'student_documents'")
	if err != nil {
		fmt.Printf("ERROR: %v\n", err)
	} else {
		defer rows.Close()
        fmt.Print("Columns in student_documents table: ")
		count := 0
		for rows.Next() {
			var col string
			rows.Scan(&col)
			fmt.Printf("%s, ", col)
			count++
		}
		if count == 0 {
		    fmt.Print("TABLE DOES NOT EXIST")
		}
		fmt.Println()
	}
}
