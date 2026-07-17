package services

import (
	"context"
	"net"
	"net/http"
	"strings"
	"time"

	"campusbites/backend/internal/database"
	"campusbites/backend/internal/models"
)

type AuditService struct {
	db *database.DB
}

func NewAuditService(db *database.DB) *AuditService {
	return &AuditService{db: db}
}

// LogAction inserts a new audit log entry into the database.
func (s *AuditService) LogAction(ctx context.Context, actorID, actorRole, action string, r *http.Request) error {
	ipAddress := getClientIP(r)
	userAgent := r.Header.Get("User-Agent")

	query := `
		INSERT INTO audit_logs (actor_id, actor_role, action, ip_address, user_agent, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`

	_, err := s.db.Pool.Exec(ctx, query, actorID, actorRole, action, ipAddress, userAgent, time.Now())
	return err
}

// FetchLogs retrieves audit logs for administrative review.
func (s *AuditService) FetchLogs(ctx context.Context, limit, offset int) ([]models.AuditLog, error) {
	query := `
		SELECT id, actor_id, actor_role, action, ip_address, user_agent, created_at
		FROM audit_logs
		ORDER BY created_at DESC
		LIMIT $1 OFFSET $2
	`

	rows, err := s.db.Pool.Query(ctx, query, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []models.AuditLog
	for rows.Next() {
		var log models.AuditLog
		err := rows.Scan(
			&log.ID,
			&log.ActorID,
			&log.ActorRole,
			&log.Action,
			&log.IPAddress,
			&log.UserAgent,
			&log.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		logs = append(logs, log)
	}

	return logs, nil
}

// getClientIP extracts the real IP address of the client from HTTP headers or remote address.
func getClientIP(r *http.Request) string {
	// Check Cloudflare headers
	if cfIP := r.Header.Get("CF-Connecting-IP"); cfIP != "" {
		return cfIP
	}

	// Check standard proxy headers
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		ips := strings.Split(xff, ",")
		if len(ips) > 0 {
			return strings.TrimSpace(ips[0])
		}
	}

	// Fallback to standard RemoteAddr
	ip, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return ip
}
