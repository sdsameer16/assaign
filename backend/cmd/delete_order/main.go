package main

import (
	"context"
	"fmt"
	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	dbURL := "postgresql://neondb_owner:npg_oawN4Uq6JgOj@ep-shy-union-at36y8eu-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require"
	pool, _ := pgxpool.New(context.Background(), dbURL)
	defer pool.Close()

	var id, orderNum string
	err := pool.QueryRow(context.Background(), "SELECT id, order_number FROM orders WHERE order_number LIKE $1", "%11466%").Scan(&id, &orderNum)
	if err != nil {
		fmt.Println("Not found:", err)
		return
	}
	fmt.Println("Found:", id, orderNum)

	tx, _ := pool.Begin(context.Background())
	tx.Exec(context.Background(), "DELETE FROM delivery_assignments WHERE order_id = $1", id)
	tx.Exec(context.Background(), "DELETE FROM payments WHERE order_id = $1", id)
	tx.Exec(context.Background(), "DELETE FROM order_status_history WHERE order_id = $1", id)
	tx.Exec(context.Background(), "DELETE FROM order_items WHERE order_id = $1", id)
	tx.Exec(context.Background(), "DELETE FROM orders WHERE id = $1", id)
	tx.Commit(context.Background())
	fmt.Println("Deleted successfully!")
}
