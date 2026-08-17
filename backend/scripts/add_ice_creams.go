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
	
	var exists bool
	err = pool.QueryRow(context.Background(), "SELECT EXISTS(SELECT 1 FROM categories WHERE name = 'Ice Creams')").Scan(&exists)
	if err != nil {
		log.Fatal(err)
	}
	if !exists {
		_, err = pool.Exec(context.Background(), "INSERT INTO categories (name) VALUES ('Ice Creams')")
		if err != nil {
			log.Fatal(err)
		}
		fmt.Println("Added Ice Creams to database!")
	} else {
		fmt.Println("Ice Creams already in database.")
	}
}
