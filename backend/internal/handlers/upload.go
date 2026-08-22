package handlers

import (
	"bytes"
	"fmt"
	"io"
	"log"
	"net/http"
	"path/filepath"
	"strings"
)

const maxUploadSizeBytes = 15 * 1024 * 1024 // 15MB

var allowedExtensions = map[string]bool{
	"pdf":  true,
	"jpeg": true,
	"jpg":  true,
	"png":  true,
	"webp": true,
}

var imageExtensions = map[string]bool{
	"jpeg": true,
	"jpg":  true,
	"png":  true,
	"webp": true,
}

var rejectedOfficeExtensions = map[string]string{
	"doc":  "Word document not supported. Please convert your Word document to PDF before uploading.",
	"docx": "Word document not supported. Please convert your Word document to PDF before uploading.",
	"xls":  "Excel document not supported. Please convert your Excel document to PDF before uploading.",
	"xlsx": "Excel document not supported. Please convert your Excel document to PDF before uploading.",
	"csv":  "Excel document not supported. Please convert your Excel document to PDF before uploading.",
	"ppt":  "PowerPoint document not supported. Please convert your document to PDF before uploading.",
	"pptx": "PowerPoint document not supported. Please convert your document to PDF before uploading.",
	"txt":  "Text document not supported. Please convert your document to PDF before uploading.",
}

// StudentUploadFile handles multipart/form-data file uploads from frontend applications.
func (hCtx *HandlerContext) StudentUploadFile(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxUploadSizeBytes)

	if err := r.ParseMultipartForm(maxUploadSizeBytes); err != nil {
		log.Printf("[UPLOAD_REQUEST_REJECTED] Payload too large or invalid multipart form: %v", err)
		RespondError(w, http.StatusRequestEntityTooLarge, "File is too large. Maximum allowed upload size is 15MB.")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		log.Printf("[UPLOAD_REQUEST_REJECTED] Missing file field in request: %v", err)
		RespondError(w, http.StatusBadRequest, "Missing 'file' form field in request.")
		return
	}
	defer file.Close()

	fileName := strings.TrimSpace(header.Filename)
	fileSize := header.Size

	log.Printf("[UPLOAD_REQUEST_RECEIVED] File: %s, Size: %d bytes, RemoteIP: %s", fileName, fileSize, r.RemoteAddr)

	if fileSize == 0 {
		log.Printf("[UPLOAD_REQUEST_REJECTED] Empty 0-byte file: %s", fileName)
		RespondError(w, http.StatusBadRequest, "Selected file is 0 bytes (empty file).")
		return
	}

	if fileSize > maxUploadSizeBytes {
		log.Printf("[UPLOAD_REQUEST_REJECTED] File size exceeds 15MB limit: %d bytes", fileSize)
		RespondError(w, http.StatusRequestEntityTooLarge, fmt.Sprintf("File size (%.1fMB) exceeds maximum limit of 15MB.", float64(fileSize)/(1024*1024)))
		return
	}

	ext := strings.ToLower(strings.TrimPrefix(filepath.Ext(fileName), "."))

	if rejectionMsg, isOffice := rejectedOfficeExtensions[ext]; isOffice {
		log.Printf("[UPLOAD_REQUEST_REJECTED] Office format rejected: %s", ext)
		RespondError(w, http.StatusBadRequest, rejectionMsg)
		return
	}

	if !allowedExtensions[ext] {
		log.Printf("[UPLOAD_REQUEST_REJECTED] Unsupported file extension: %s", ext)
		RespondError(w, http.StatusBadRequest, fmt.Sprintf("Unsupported file format '.%s'. Accepted formats: PDF, JPG, JPEG, PNG, WEBP. Please convert documents to PDF.", ext))
		return
	}

	// Verify file content magic bytes (signatures)
	buf := make([]byte, 512)
	n, _ := io.ReadFull(file, buf)
	if n > 0 {
		buf = buf[:n]
	}
	if seeker, ok := file.(io.Seeker); ok {
		seeker.Seek(0, io.SeekStart)
	}

	if ext == "pdf" {
		if !bytes.HasPrefix(buf, []byte("%PDF-")) && !bytes.Contains(buf, []byte("%PDF-")) {
			log.Printf("[UPLOAD_REQUEST_REJECTED] File renamed to .pdf but lacks PDF magic bytes signature: %s", fileName)
			RespondError(w, http.StatusBadRequest, "Invalid PDF file content. The file content does not match a valid PDF document.")
			return
		}
	} else if imageExtensions[ext] {
		isJpg := bytes.HasPrefix(buf, []byte{0xFF, 0xD8, 0xFF})
		isPng := bytes.HasPrefix(buf, []byte("\x89PNG\r\n\x1a\n"))
		isWebp := bytes.HasPrefix(buf, []byte("RIFF")) && bytes.Contains(buf, []byte("WEBP"))

		if !isJpg && !isPng && !isWebp {
			log.Printf("[UPLOAD_REQUEST_REJECTED] File renamed to .%s but lacks valid image magic bytes signature: %s", ext, fileName)
			RespondError(w, http.StatusBadRequest, fmt.Sprintf("Invalid photo content. The file signature does not match a valid .%s image.", ext))
			return
		}
	}

	resourceType := "raw"
	if imageExtensions[ext] {
		resourceType = "image"
	}

	if hCtx.CloudinaryService == nil {
		log.Printf("[CLOUDINARY_UPLOAD_FAILED] CloudinaryService is nil on server")
		RespondError(w, http.StatusInternalServerError, "Storage provider configuration missing on server.")
		return
	}

	log.Printf("[CLOUDINARY_UPLOAD_STARTED] File: %s, Type: %s, ResourceType: %s", fileName, ext, resourceType)

	secureURL, publicID, err := hCtx.CloudinaryService.UploadFile(file, fileName, resourceType)
	if err != nil {
		log.Printf("[CLOUDINARY_UPLOAD_FAILED] File: %s, Error: %v", fileName, err)
		RespondError(w, http.StatusInternalServerError, fmt.Sprintf("File storage upload failed: %v", err))
		return
	}

	log.Printf("[CLOUDINARY_UPLOAD_SUCCESS] File: %s, URL: %s, PublicID: %s", fileName, secureURL, publicID)

	RespondJSON(w, http.StatusOK, map[string]interface{}{
		"success":      true,
		"url":          secureURL,
		"fileName":     fileName,
		"fileType":     ext,
		"publicId":     publicID,
		"resourceType": resourceType,
	})
}
