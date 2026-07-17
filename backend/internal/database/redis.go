package database

import (
	"context"
	"crypto/tls"
	"errors"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
)

type RedisDB struct {
	Client *redis.Client
}

func ConnectRedis(addr, username, password string, useTLS bool) (*RedisDB, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	opts := &redis.Options{
		Addr:     addr,
		Username: username,
		Password: password,
	}

	if useTLS {
		opts.TLSConfig = &tls.Config{
			MinVersion: tls.VersionTLS12,
		}
	}

	client := redis.NewClient(opts)

	// Ping connection
	err := client.Ping(ctx).Err()
	if err != nil {
		client.Close()
		return nil, err
	}

	log.Printf("Successfully connected to Redis at %s (TLS: %v)\n", addr, useTLS)
	return &RedisDB{Client: client}, nil
}

func (r *RedisDB) Close() {
	if r.Client != nil {
		r.Client.Close()
		log.Println("Closed Redis client connection.")
	}
}

// TestSetGet performs a diagnostic Set and Get operation.
func (r *RedisDB) TestSetGet(key, value string) error {
	ctx := context.Background()

	err := r.Client.Set(ctx, key, value, 10*time.Minute).Err()
	if err != nil {
		return err
	}

	val, err := r.Client.Get(ctx, key).Result()
	if err != nil {
		return err
	}

	if val != value {
		return errors.New("read value does not match written value")
	}

	log.Printf("Redis Diagnostic Check Passed: [Key: %s, Val: %s]\n", key, val)
	return nil
}
