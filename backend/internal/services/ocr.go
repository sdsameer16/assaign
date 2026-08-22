package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"mime/multipart"
	"net/http"
	"regexp"
	"strings"
	"time"

	"campusbites/backend/internal/models"
)

type OCRService struct {
	provider string
	apiKey   string
}

func NewOCRService(provider, apiKey string) *OCRService {
	return &OCRService{
		provider: provider,
		apiKey:   apiKey,
	}
}

type OCRSpaceResponse struct {
	ParsedResults []struct {
		ParsedText string `json:"ParsedText"`
		ErrorMessage string `json:"ErrorMessage"`
	} `json:"ParsedResults"`
	IsErroredOnProcessing bool        `json:"IsErroredOnProcessing"`
	ErrorMessage          interface{} `json:"ErrorMessage"`
	OCRExitCode           int         `json:"OCRExitCode"`
}

func (s *OCRService) resolveAPIKey() string {
	key := strings.TrimSpace(s.apiKey)
	if key == "" || key == "mock-ocr-key-12345" {
		log.Println("WARNING: OCR_API_KEY is missing or set to placeholder. Using default key, which may be rate-limited.")
		return "helloworld"
	}
	return key
}

func (s *OCRService) extractTextFromURL(idCardURL string) (string, error) {
	if !strings.HasPrefix(idCardURL, "http://") && !strings.HasPrefix(idCardURL, "https://") {
		return "", fmt.Errorf("id card url must be an http(s) image url")
	}

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	_ = writer.WriteField("apikey", s.resolveAPIKey())
	_ = writer.WriteField("url", idCardURL)
	_ = writer.WriteField("language", "eng")
	_ = writer.WriteField("isOverlayRequired", "false")
	_ = writer.WriteField("OCREngine", "2")
	_ = writer.WriteField("scale", "true")
	_ = writer.WriteField("detectOrientation", "true")
	_ = writer.Close()

	req, err := http.NewRequest("POST", "https://api.ocr.space/parse/image", &body)
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	client := &http.Client{Timeout: 45 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("ocr.space returned status code %d: %s", resp.StatusCode, string(respBytes))
	}

	var ocrResp OCRSpaceResponse
	if err := json.Unmarshal(respBytes, &ocrResp); err != nil {
		return "", err
	}

	if ocrResp.IsErroredOnProcessing {
		return "", fmt.Errorf("ocr error: %v", ocrResp.ErrorMessage)
	}

	if len(ocrResp.ParsedResults) == 0 {
		return "", fmt.Errorf("no text extracted from ID card")
	}

	text := strings.TrimSpace(ocrResp.ParsedResults[0].ParsedText)
	if text == "" {
		return "", fmt.Errorf("empty text extracted from ID card")
	}

	return text, nil
}

var (
	nameLabelRe = regexp.MustCompile(`(?i)^\s*(?:student\s*)?name\s*[:\-]\s*(.+)$`)
	rollLabelRe = regexp.MustCompile(`(?i)^\s*(?:roll|reg(?:istration)?|enrollment|enrolment|id)\s*(?:no|number|#)?\s*[:\-]?\s*([A-Za-z0-9\-\/]+)\s*$`)
	rollTokenRe = regexp.MustCompile(`(?i)\b[A-Z]{0,6}\d{2,}[A-Z0-9\-\/]*\b`)
)

func normalizeOCRText(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	s = strings.Join(strings.Fields(s), " ")
	return s
}

func stripOCRLabels(line string) string {
	line = strings.TrimSpace(line)
	if m := nameLabelRe.FindStringSubmatch(line); len(m) == 2 {
		return strings.TrimSpace(m[1])
	}
	if m := rollLabelRe.FindStringSubmatch(line); len(m) == 2 {
		return strings.TrimSpace(m[1])
	}
	return line
}

// matchScore returns similarity 0..1 with containment boosts for ID-card lines.
func (s *OCRService) matchScore(expected, candidate string) float64 {
	e := normalizeOCRText(expected)
	c := normalizeOCRText(stripOCRLabels(candidate))
	if e == "" || c == "" {
		return 0
	}
	if e == c {
		return 1
	}
	if strings.Contains(c, e) || strings.Contains(e, c) {
		shorter := math.Min(float64(len(e)), float64(len(c)))
		longer := math.Max(float64(len(e)), float64(len(c)))
		return math.Max(0.9, shorter/longer)
	}
	return s.CalculateSimilarity(e, c)
}

func (s *OCRService) extractNameAndRoll(parsedText, shortName, rollNumber string) (extractedName, extractedRoll string, nameSimilarity float64) {
	rawLines := strings.Split(parsedText, "\n")
	var lines []string
	for _, line := range rawLines {
		line = strings.TrimSpace(line)
		if line != "" {
			lines = append(lines, line)
		}
	}

	fullText := strings.Join(lines, "\n")
	normFull := normalizeOCRText(fullText)
	normName := normalizeOCRText(shortName)
	normRoll := normalizeOCRText(rollNumber)

	bestNameLine := "No Match Found"
	maxNameSim := 0.0
	bestRollLine := "No Match Found"
	maxRollSim := 0.0

	// Prefer labeled fields
	for _, line := range lines {
		if m := nameLabelRe.FindStringSubmatch(line); len(m) == 2 {
			sim := s.matchScore(shortName, m[1])
			if sim > maxNameSim {
				maxNameSim = sim
				bestNameLine = strings.TrimSpace(m[1])
			}
		}
		if m := rollLabelRe.FindStringSubmatch(line); len(m) == 2 {
			sim := s.matchScore(rollNumber, m[1])
			if sim > maxRollSim {
				maxRollSim = sim
				bestRollLine = strings.TrimSpace(m[1])
			}
		}
	}

	for _, line := range lines {
		simName := s.matchScore(shortName, line)
		if simName > maxNameSim {
			maxNameSim = simName
			bestNameLine = stripOCRLabels(line)
		}
		simRoll := s.matchScore(rollNumber, line)
		if simRoll > maxRollSim {
			maxRollSim = simRoll
			bestRollLine = stripOCRLabels(line)
		}
	}

	// Exact roll token search across full text
	if normRoll != "" && strings.Contains(normFull, normRoll) {
		maxRollSim = 1
		bestRollLine = rollNumber
	} else {
		for _, tok := range rollTokenRe.FindAllString(fullText, -1) {
			sim := s.matchScore(rollNumber, tok)
			if sim > maxRollSim {
				maxRollSim = sim
				bestRollLine = tok
			}
		}
	}

	if normName != "" && strings.Contains(normFull, normName) && maxNameSim < 0.95 {
		maxNameSim = 0.95
		bestNameLine = shortName
	}

	if maxNameSim > 0.3 {
		extractedName = bestNameLine
		nameSimilarity = maxNameSim
	} else {
		extractedName = "No Match Found"
		nameSimilarity = maxNameSim
	}

	if maxRollSim > 0.3 {
		extractedRoll = bestRollLine
	} else {
		extractedRoll = "No Match Found"
	}

	return extractedName, extractedRoll, nameSimilarity
}

// ProcessVerification runs OCR and calculates name matching scores.
func (s *OCRService) ProcessVerification(shortName, rollNumber, idCardURL string) (*models.StudentDocument, error) {
	parsedText, err := s.extractTextFromURL(idCardURL)
	if err != nil {
		log.Printf("OCR extraction failed: %v\n", err)
		return nil, fmt.Errorf("could not read ID card text — please retake a clear photo of your ID: %w", err)
	}
	extractedName, extractedRoll, nameSimilarity := s.extractNameAndRoll(parsedText, shortName, rollNumber)
	log.Printf("OCR extracted name=%q roll=%q score=%.2f\n", extractedName, extractedRoll, nameSimilarity*100)

	confidence := models.ConfidenceLevelLow
	if nameSimilarity >= 0.85 {
		confidence = models.ConfidenceLevelHigh
	} else if nameSimilarity >= 0.60 {
		confidence = models.ConfidenceLevelMedium
	}

	return &models.StudentDocument{
		IDCardURL:              idCardURL,
		OCRExtractedName:       extractedName,
		OCRExtractedRollNumber: extractedRoll,
		NameSimilarityScore:    nameSimilarity * 100.0,
		DuplicateFlag:          false,
		ConfidenceLevel:        confidence,
	}, nil
}

// CalculateSimilarity calculates Levenshtein similarity score between 0.0 and 1.0.
func (s *OCRService) CalculateSimilarity(s1, s2 string) float64 {
	if s1 == s2 {
		return 1.0
	}
	if len(s1) == 0 || len(s2) == 0 {
		return 0.0
	}

	distance := levenshteinDistance(s1, s2)
	maxLen := math.Max(float64(len(s1)), float64(len(s2)))

	return 1.0 - (float64(distance) / maxLen)
}

func levenshteinDistance(s1, s2 string) int {
	len1 := len(s1)
	len2 := len(s2)

	row := make([]int, len2+1)
	for i := 0; i <= len2; i++ {
		row[i] = i
	}

	for i := 1; i <= len1; i++ {
		prev := i
		for j := 1; j <= len2; j++ {
			val := row[j-1]
			if s1[i-1] != s2[j-1] {
				val = min(row[j-1]+1, min(row[j]+1, prev+1))
			}
			row[j-1] = prev
			prev = val
		}
		row[len2] = prev
	}

	return row[len2]
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
