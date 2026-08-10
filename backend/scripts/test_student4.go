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
	
	// Create enum if it does not exist
	_, err = pool.Exec(context.Background(), "DO $$ BEGIN CREATE TYPE verification_status AS ENUM ('pending', 'verified', 'rejected'); EXCEPTION WHEN duplicate_object THEN null; END $$;")
	if err != nil {
		fmt.Printf("Warning: %v\n", err)
	}
	
    // Add verification_status column
	_, err = pool.Exec(context.Background(), "ALTER TABLE students ADD COLUMN verification_status verification_status DEFAULT 'verified';")
	if err != nil {
		fmt.Printf("ERROR altering table: %v\n", err)
	} else {
		fmt.Println("Successfully added verification_status column to students table!")
	}
}
