package config

import (
	"log"
	"os"
	"strconv"
	"strings"

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
	AllowedOrigins        []string
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

	isProd := strings.EqualFold(env, "production")

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		if isProd {
			log.Fatal("JWT_SECRET must be set in production")
		}
		jwtSecret = "campusbites_jwt_super_secure_secret_key_2026"
		log.Println("WARNING: using default JWT_SECRET; set JWT_SECRET for non-local use")
	}

	ocrProvider := getEnv("OCR_PROVIDER", "mock")
	ocrApiKey := getEnv("OCR_API_KEY", "mock-ocr-key-12345")

	rzpKeyID := os.Getenv("RAZORPAY_KEY_ID")
	rzpSecret := os.Getenv("RAZORPAY_KEY_SECRET")
	rzpWebhookSecret := os.Getenv("RAZORPAY_WEBHOOK_SECRET")
	if isProd {
		if rzpKeyID == "" || rzpSecret == "" || rzpWebhookSecret == "" {
			log.Fatal("RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, and RAZORPAY_WEBHOOK_SECRET must be set in production")
		}
	} else {
		if rzpKeyID == "" {
			rzpKeyID = "rzp_test_keyid_12345"
			log.Println("WARNING: using default RAZORPAY_KEY_ID")
		}
		if rzpSecret == "" {
			rzpSecret = "rzp_test_secret_12345"
			log.Println("WARNING: using default RAZORPAY_KEY_SECRET")
		}
		if rzpWebhookSecret == "" {
			rzpWebhookSecret = "rzp_webhook_secret_12345"
			log.Println("WARNING: using default RAZORPAY_WEBHOOK_SECRET")
		}
	}

	jwtExpiryStr := getEnv("JWT_EXPIRY_HOURS", "168")
	jwtExpiry, err := strconv.Atoi(jwtExpiryStr)
	if err != nil {
		jwtExpiry = 168
	}

	if dbURL == "" {
		log.Println("WARNING: DATABASE_URL is not set. Database connections will fail unless set.")
	}

	allowedOrigins := parseOrigins(os.Getenv("ALLOWED_ORIGINS"))
	if len(allowedOrigins) == 0 {
		allowedOrigins = []string{
			"http://localhost:3000",
			"http://localhost:3001",
			"http://localhost:3002",
			"http://127.0.0.1:3000",
			"http://127.0.0.1:3001",
			"http://127.0.0.1:3002",
		}
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
		AllowedOrigins:        allowedOrigins,
	}
}

func getEnv(key, defaultVal string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultVal
}

func parseOrigins(raw string) []string {
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	var out []string
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}
