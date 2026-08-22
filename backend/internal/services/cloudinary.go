package services

import (
	"bytes"
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"net/url"
	"path"
	"regexp"
	"strconv"
	"strings"
	"time"
)

var cloudinaryVersionRE = regexp.MustCompile(`^v\d+$`)

// CloudinaryService handles server-side uploads and post-delivery deletion of Cloudinary assets.
type CloudinaryService struct {
	CloudName string
	APIKey    string
	APISecret string
	client    *http.Client
}

func NewCloudinaryService(cloudName, apiKey, apiSecret string) *CloudinaryService {
	cloudName = strings.TrimSpace(cloudName)
	apiKey = strings.TrimSpace(apiKey)
	apiSecret = strings.TrimSpace(apiSecret)
	if cloudName == "" {
		return nil
	}
	return &CloudinaryService{
		CloudName: cloudName,
		APIKey:    apiKey,
		APISecret: apiSecret,
		client:    &http.Client{Timeout: 35 * time.Second},
	}
}

// UploadFile uploads a file reader to Cloudinary server-side.
func (cs *CloudinaryService) UploadFile(fileReader io.Reader, fileName string, resourceType string) (secureURL string, publicID string, err error) {
	if cs == nil || cs.CloudName == "" {
		return "", "", fmt.Errorf("cloudinary service not configured on server")
	}

	if resourceType != "image" && resourceType != "raw" && resourceType != "auto" {
		resourceType = "auto"
	}

	endpoint := fmt.Sprintf("https://api.cloudinary.com/v1_1/%s/%s/upload", cs.CloudName, resourceType)

	bodyBuf := &bytes.Buffer{}
	mw := multipart.NewWriter(bodyBuf)

	fileWriter, err := mw.CreateFormFile("file", fileName)
	if err != nil {
		return "", "", fmt.Errorf("failed to create multipart file field: %w", err)
	}
	if _, err := io.Copy(fileWriter, fileReader); err != nil {
		return "", "", fmt.Errorf("failed to copy file payload: %w", err)
	}

	timestamp := strconv.FormatInt(time.Now().Unix(), 10)

	if cs.APIKey != "" && cs.APISecret != "" {
		mw.WriteField("api_key", cs.APIKey)
		mw.WriteField("timestamp", timestamp)

		stringToSign := fmt.Sprintf("timestamp=%s%s", timestamp, cs.APISecret)
		h := sha1.New()
		h.Write([]byte(stringToSign))
		signature := hex.EncodeToString(h.Sum(nil))

		mw.WriteField("signature", signature)
	} else {
		mw.WriteField("upload_preset", "CmpsBites")
	}

	if err := mw.Close(); err != nil {
		return "", "", fmt.Errorf("failed to construct multipart request body: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, endpoint, bodyBuf)
	if err != nil {
		return "", "", fmt.Errorf("failed to create http request: %w", err)
	}
	req.Header.Set("Content-Type", mw.FormDataContentType())

	resp, err := cs.client.Do(req)
	if err != nil {
		return "", "", fmt.Errorf("cloudinary request failed: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", "", fmt.Errorf("failed to read response from storage provider: %w", err)
	}

	var result struct {
		SecureURL string `json:"secure_url"`
		PublicID  string `json:"public_id"`
		Error     struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(respBytes, &result); err != nil {
		return "", "", fmt.Errorf("invalid response format from storage provider (%d)", resp.StatusCode)
	}

	if resp.StatusCode >= 300 {
		errMsg := result.Error.Message
		if errMsg == "" {
			errMsg = string(respBytes)
		}
		return "", "", fmt.Errorf("cloudinary storage rejection (%d): %s", resp.StatusCode, errMsg)
	}

	if result.SecureURL == "" {
		return "", "", fmt.Errorf("cloudinary upload succeeded but secure_url was empty")
	}

	return result.SecureURL, result.PublicID, nil
}

// DeleteByURL destroys a Cloudinary asset identified by its delivery URL.
func (cs *CloudinaryService) DeleteByURL(fileURL string) error {
	if cs == nil {
		return fmt.Errorf("cloudinary service not configured")
	}
	resourceType, publicID, ok := ParseCloudinaryURL(fileURL)
	if !ok {
		return fmt.Errorf("unrecognized cloudinary url")
	}

	err := cs.destroy(resourceType, publicID)
	if err == nil {
		return nil
	}

	// Misclassified uploads (PDF stored as image vs raw) — try the other type.
	alt := "raw"
	if resourceType == "raw" {
		alt = "image"
	}
	if altErr := cs.destroy(alt, publicID); altErr == nil {
		return nil
	}
	// Image public_ids omit extension; raw often includes it.
	if resourceType == "image" || alt == "image" {
		withExt := publicID
		if ext := path.Ext(fileURL); ext != "" && !strings.HasSuffix(publicID, ext) {
			withExt = publicID + ext
			if altErr := cs.destroy("raw", withExt); altErr == nil {
				return nil
			}
		}
	}
	return err
}

func (cs *CloudinaryService) destroy(resourceType, publicID string) error {
	endpoint := fmt.Sprintf(
		"https://api.cloudinary.com/v1_1/%s/%s/destroy",
		cs.CloudName,
		resourceType,
	)
	form := url.Values{}
	form.Set("public_id", publicID)
	form.Set("invalidate", "true")

	req, err := http.NewRequest(http.MethodPost, endpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.SetBasicAuth(cs.APIKey, cs.APISecret)

	resp, err := cs.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	var parsed struct {
		Result string `json:"result"`
		Error  struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	_ = json.Unmarshal(body, &parsed)

	if resp.StatusCode >= 300 {
		msg := parsed.Error.Message
		if msg == "" {
			msg = string(body)
		}
		return fmt.Errorf("cloudinary destroy %s/%s failed: %s", resourceType, publicID, msg)
	}
	// "ok" or "not found" both mean the asset is gone / not deliverable.
	if parsed.Result == "ok" || parsed.Result == "not found" {
		return nil
	}
	log.Printf("cloudinary destroy unexpected result for %s/%s: %s", resourceType, publicID, string(body))
	return nil
}

// ParseCloudinaryURL extracts resource type and public_id from a delivery URL.
func ParseCloudinaryURL(fileURL string) (resourceType, publicID string, ok bool) {
	u, err := url.Parse(strings.TrimSpace(fileURL))
	if err != nil || u.Host == "" {
		return "", "", false
	}
	if !strings.Contains(u.Host, "res.cloudinary.com") && !strings.Contains(u.Host, "cloudinary.com") {
		return "", "", false
	}

	segs := strings.Split(strings.Trim(u.Path, "/"), "/")
	// Expected: {cloud}/{resource_type}/upload/...
	if len(segs) < 4 {
		return "", "", false
	}
	resourceType = segs[1]
	if segs[2] != "upload" && segs[2] != "authenticated" && segs[2] != "private" {
		return "", "", false
	}

	rest := segs[3:]
	i := 0
	for i < len(rest) {
		seg := rest[i]
		if cloudinaryVersionRE.MatchString(seg) {
			i++
			break
		}
		// Skip transformation segments (e.g. fl_attachment:name.pdf, c_fill,w_100)
		if strings.ContainsAny(seg, ",:") || strings.HasPrefix(seg, "fl_") {
			i++
			continue
		}
		break
	}
	if i >= len(rest) {
		return "", "", false
	}

	publicID = strings.Join(rest[i:], "/")
	if publicID == "" {
		return "", "", false
	}

	if resourceType == "image" || resourceType == "video" {
		if ext := path.Ext(publicID); ext != "" {
			publicID = strings.TrimSuffix(publicID, ext)
		}
	}
	return resourceType, publicID, true
}
