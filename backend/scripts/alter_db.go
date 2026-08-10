package main

import (
	"context"
	"fmt"
	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	dbURL := "postgresql://neondb_owner:npg_oawN4Uq6JgOj@ep-shy-union-at36y8eu-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require"
	pool, err := pgxpool.New(context.Background(), dbURL)
	if err != nil {
		fmt.Printf("Unable to connect to database: %v\n", err)
		return
	}
	defer pool.Close()

	_, err = pool.Exec(context.Background(), "ALTER TABLE students ADD COLUMN IF NOT EXISTS fcm_token TEXT")
	if err != nil {
		fmt.Printf("Failed to add column: %v\n", err)
		return
	}
	fmt.Printf("Successfully added fcm_token column!\n")
}

