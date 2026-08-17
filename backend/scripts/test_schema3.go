//go:build ignore

package main
import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"
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
	
	schemaBytes, _ := os.ReadFile("schema.sql")
	stmts := strings.Split(string(schemaBytes), ";")
	for i, stmt := range stmts {
	    stmt = strings.TrimSpace(stmt)
	    if stmt == "" {
	        continue
	    }
	    _, err = pool.Exec(context.Background(), stmt)
	    if err != nil {
	        fmt.Printf("ERROR at stmt %d: %v\n%s\n", i, err, stmt)
	        return
	    }
	}
	fmt.Println("SUCCESS")
}
