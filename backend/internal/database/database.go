package database

import (
	"context"
	"log"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type DB struct {
	Pool *pgxpool.Pool
}

func ConnectDB(databaseURL string) (*DB, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, err
	}

	// Set connection pool parameters
	config.MaxConns = 200 // Increased for 1000+ concurrent users
	config.MinConns = 10
	config.MaxConnLifetime = 30 * time.Minute
	config.MaxConnIdleTime = 15 * time.Minute

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, err
	}

	// Ping connection to confirm active link
	err = pool.Ping(ctx)
	if err != nil {
		pool.Close()
		return nil, err
	}

	log.Println("Successfully connected to the PostgreSQL database pool.")
	return &DB{Pool: pool}, nil
}

func (db *DB) Close() {
	if db.Pool != nil {
		db.Pool.Close()
		log.Println("Closed database connection pool.")
	}
}

// InitializeSchema reads and runs the schema.sql file to bootstrap the database tables.
func (db *DB) InitializeSchema(schemaFilePath string) error {
	schemaBytes, err := os.ReadFile(schemaFilePath)
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	_, err = db.Pool.Exec(ctx, string(schemaBytes))
	if err != nil {
		return err
	}

	log.Println("Database schema successfully initialized.")
	return nil
}
