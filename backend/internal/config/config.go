package config

import (
	"log"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	Port                  string
	Env                   string
	DatabaseURL           string
	RedisURL              string
	RedisAddr             string
	RedisUsername         string
	RedisPassword         string
	RedisUseTLS           bool
	JWTSecret             string
	JWTExpiryHours        int
	OCRProvider           string
	OCRApiKey             string
	RazorpayKeyID         string
	RazorpayKeySecret     string
	RazorpayWebhookSecret string
}

func LoadConfig() *Config {
	// Attempt to load .env file. Ignore errors since environment variables
	// can also be set directly in the system or container runtime.
	_ = godotenv.Load()

	port := getEnv("PORT", "8080")
	env := getEnv("ENV", "development")
	dbURL := getEnv("DATABASE_URL", "")
	redisURL := getEnv("REDIS_URL", "")
	redisAddr := getEnv("REDIS_ADDR", "localhost:6379")
	redisUsername := getEnv("REDIS_USERNAME", "default")
	redisPassword := getEnv("REDIS_PASSWORD", "")
	redisUseTLSStr := getEnv("REDIS_USE_TLS", "false")
	redisUseTLS := redisUseTLSStr == "true"

	jwtSecret := getEnv("JWT_SECRET", "campusbites_jwt_super_secure_secret_key_2026")
	ocrProvider := getEnv("OCR_PROVIDER", "mock")
	ocrApiKey := getEnv("OCR_API_KEY", "mock-ocr-key-12345")
	rzpKeyID := getEnv("RAZORPAY_KEY_ID", "rzp_test_keyid_12345")
	rzpSecret := getEnv("RAZORPAY_KEY_SECRET", "rzp_test_secret_12345")
	rzpWebhookSecret := getEnv("RAZORPAY_WEBHOOK_SECRET", "rzp_webhook_secret_12345")

	jwtExpiryStr := getEnv("JWT_EXPIRY_HOURS", "24")
	jwtExpiry, err := strconv.Atoi(jwtExpiryStr)
	if err != nil {
		jwtExpiry = 24
	}

	if dbURL == "" {
		log.Println("WARNING: DATABASE_URL is not set. Database connections will fail unless set.")
	}

	return &Config{
		Port:                  port,
		Env:                   env,
		DatabaseURL:           dbURL,
		RedisURL:              redisURL,
		RedisAddr:             redisAddr,
		RedisUsername:         redisUsername,
		RedisPassword:         redisPassword,
		RedisUseTLS:           redisUseTLS,
		JWTSecret:             jwtSecret,
		JWTExpiryHours:        jwtExpiry,
		OCRProvider:           ocrProvider,
		OCRApiKey:             ocrApiKey,
		RazorpayKeyID:         rzpKeyID,
		RazorpayKeySecret:     rzpSecret,
		RazorpayWebhookSecret: rzpWebhookSecret,
	}
}

func getEnv(key, defaultVal string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultVal
}
