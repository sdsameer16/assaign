package middleware

import (
	"net/http"
	"strings"
)

var allowedOrigins []string

// SetAllowedOrigins configures CORS allowlist (call once at startup).
func SetAllowedOrigins(origins []string) {
	allowedOrigins = origins
}

// CORSMiddleware sets up standard CORS headers for requests.
func CORSMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" {
			if len(allowedOrigins) == 0 || originAllowed(origin) {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Vary", "Origin")
				w.Header().Set("Access-Control-Allow-Credentials", "true")
			}
		} else {
			w.Header().Set("Access-Control-Allow-Origin", "*")
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, X-Requested-With")
		w.Header().Set("Access-Control-Max-Age", "86400")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func originAllowed(origin string) bool {
	if origin == "" {
		return false
	}
	if len(allowedOrigins) == 0 {
		return true
	}
	lowerOrigin := strings.ToLower(origin)
	if strings.HasSuffix(lowerOrigin, ".netlify.app") {
		return true
	}
	for _, o := range allowedOrigins {
		if o == "*" || strings.EqualFold(o, origin) {
			return true
		}
	}
	return false
}
