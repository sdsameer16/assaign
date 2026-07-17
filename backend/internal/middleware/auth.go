package middleware

import (
	"context"
	"net/http"
	"strings"

	"campusbites/backend/internal/services"
)

const (
	UserIDKey = "user_id"
	RoleKey   = "role"
)

// AuthMiddleware extracts JWT and injects claims into request context.
func AuthMiddleware(authService *services.AuthService) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				http.Error(w, "missing authorization header", http.StatusUnauthorized)
				return
			}

			parts := strings.Split(authHeader, " ")
			if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
				http.Error(w, "invalid authorization header format", http.StatusUnauthorized)
				return
			}

			claims, err := authService.VerifyJWT(parts[1])
			if err != nil {
				http.Error(w, "invalid or expired token: "+err.Error(), http.StatusUnauthorized)
				return
			}

			// Inject user identity into context
			ctx := context.WithValue(r.Context(), UserIDKey, claims.UserID)
			ctx = context.WithValue(ctx, RoleKey, claims.Role)

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequireRole guards endpoints, verifying that the user holds the appropriate role claim.
func RequireRole(allowedRoles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userRole, ok := r.Context().Value(RoleKey).(string)
			if !ok {
				http.Error(w, "unauthorized role context", http.StatusUnauthorized)
				return
			}

			roleAllowed := false
			for _, role := range allowedRoles {
				if userRole == role {
					roleAllowed = true
					break
				}
			}

			if !roleAllowed {
				http.Error(w, "forbidden: insufficient permissions", http.StatusForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// GetUserFromContext retrieves the authenticated user details from context.
func GetUserFromContext(ctx context.Context) (string, string) {
	userID, _ := ctx.Value(UserIDKey).(string)
	role, _ := ctx.Value(RoleKey).(string)
	return userID, role
}
