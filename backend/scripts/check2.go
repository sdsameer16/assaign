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

	rows, err := pool.Query(context.Background(), "SELECT id, short_name, fcm_token FROM students WHERE fcm_token IS NOT NULL AND fcm_token != '")
	if err != nil {
		fmt.Printf("Query failed: %v\n", err)
		return
	}
	defer rows.Close()

	count := 0
	for rows.Next() {
		var id, shortName, token string
		if err := rows.Scan(&id, &shortName, &token); err != nil {
			fmt.Printf("Scan failed: %v\n", err)
			continue
		}
		fmt.Printf("Student %s (%s) has token: %s...\n", shortName, id, token[:10])
		count++
	}
	fmt.Printf("Total students with token: %d\n", count)
}

