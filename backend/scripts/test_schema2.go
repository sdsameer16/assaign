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
	
    // Try to run schema.sql explicitly
	schemaBytes, err := os.ReadFile("schema.sql")
	if err != nil {
	    log.Fatal(err)
	}
	_, err = pool.Exec(context.Background(), string(schemaBytes))
	if err != nil {
		fmt.Printf("ERROR running schema: %v\n", err)
	} else {
		fmt.Println("SUCCESS: schema executed")
	}
}
