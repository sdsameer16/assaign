const ACCEPTED_PRINT_EXTENSIONS = [
  "pdf",
  "jpeg",
  "jpg",
  "png",
  "webp",
] as const;

const IMAGE_EXTENSIONS = new Set(["jpeg", "jpg", "png", "webp"]);

export type AcceptedPrintExtension = (typeof ACCEPTED_PRINT_EXTENSIONS)[number];

export function getFileExtension(fileName: string): string {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

export interface ValidationResult {
  valid: boolean;
  title?: string;
  message?: string;
}

export function validatePrintingFile(file: File): ValidationResult {
  if (!file || file.size === 0) {
    return {
      valid: false,
      title: "Empty file",
      message: "Please select a valid PDF or photo file.",
    };
  }

  const ext = getFileExtension(file.name);
  const mimeType = (file.type || "").toLowerCase();

  // Unsupported document formats guidance
  if (ext === "doc" || ext === "docx") {
    return {
      valid: false,
      title: "Word document not supported",
      message:
        "Please convert your Word document to PDF before uploading. PDF and photo files are accepted for printing.",
    };
  }

  if (ext === "xls" || ext === "xlsx" || ext === "csv" || ext === "ods") {
    return {
      valid: false,
      title: "Excel document not supported",
      message:
        "Please convert your Excel document to PDF before uploading. PDF and photo files are accepted for printing.",
    };
  }

  if (ext === "ppt" || ext === "pptx" || ext === "odp") {
    return {
      valid: false,
      title: "PowerPoint document not supported",
      message:
        "Please convert your document to PDF before uploading. PDF and photo files are accepted for printing.",
    };
  }

  const allowedExts = new Set(["pdf", "jpg", "jpeg", "png", "webp"]);
  const isAllowedExt = allowedExts.has(ext);
  const isPdfMime = mimeType === "application/pdf";
  const isImageMime = mimeType.startsWith("image/");

  if (!isAllowedExt && !isPdfMime && !isImageMime) {
    return {
      valid: false,
      title: "File format not supported",
      message:
        "Please convert your document to PDF before uploading. PDF and photo files are accepted for printing.",
    };
  }

  return { valid: true };
}

export function isAcceptedPrintFile(fileName: string): boolean {
  const ext = getFileExtension(fileName);
  return (ACCEPTED_PRINT_EXTENSIONS as readonly string[]).includes(ext);
}

export function defaultPageCountForFile(fileName: string): number {
  const ext = getFileExtension(fileName);
  if (IMAGE_EXTENSIONS.has(ext)) return 1;
  return 1;
}

function resourceTypeForPrintFile(fileName: string): "image" | "raw" {
  return IMAGE_EXTENSIONS.has(getFileExtension(fileName)) ? "image" : "raw";
}

/**
 * Force a browser download for Cloudinary URLs.
 * Use bare fl_attachment — fl_attachment:filename returns 400 on raw uploads.
 */
export function cloudinaryDownloadUrl(url: string, _fileName?: string): string {
  if (!url || !url.includes("/upload/")) return url;
  if (url.includes("fl_attachment")) {
    return url.replace(/fl_attachment:[^/]+/, "fl_attachment");
  }
  return url.replace("/upload/", "/upload/fl_attachment/");
}

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB

const getBackendApiUrl = (): string => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl && envUrl.trim() !== "") {
    return envUrl.trim().replace(/\/+$/, "");
  }
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return "http://localhost:8080/api/student";
    }
    const protocol = window.location.protocol === "https:" ? "https:" : "http:";
    return `${protocol}//${window.location.host}/api/student`;
  }
  return "http://localhost:8080/api/student";
};

/** Upload a document/image via CampusBites Backend API to Cloudinary. */
export async function uploadPrintFile(file: File): Promise<{
  url: string;
  fileName: string;
  fileType: string;
}> {
  const validation = validatePrintingFile(file);
  if (!validation.valid) {
    throw new Error(validation.message || "Unsupported file format.");
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error("File is too large.");
  }

  const uploadUrl = `${getBackendApiUrl()}/upload`;
  const formData = new FormData();
  formData.append("file", file);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 40000);

  let response: Response;
  try {
    response = await fetch(uploadUrl, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });
  } catch (err: any) {
    console.error("[Backend Upload Transport Error]", {
      url: uploadUrl,
      fileName: file.name,
      fileSize: file.size,
      error: err?.message || err,
    });
    throw new Error("Unable to connect to CampusBites. Please check your connection and try again.");
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errRes = await response.json().catch(() => ({}));
    const errorMsg = errRes.error || response.statusText;
    console.error("[Backend Upload HTTP Error]", {
      url: uploadUrl,
      status: response.status,
      statusText: response.statusText,
      error: errorMsg,
      file: { name: file.name, size: file.size, type: file.type },
    });

    if (response.status === 413) {
      throw new Error("File is too large.");
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error("Upload authorization failed.");
    }
    if (response.status === 400) {
      throw new Error(errorMsg || "Invalid file payload.");
    }
    throw new Error("CampusBites could not process the file. Please try again.");
  }

  const result = await response.json();
  if (!result.url) {
    throw new Error("CampusBites could not process the file. Please try again.");
  }

  return {
    url: result.url as string,
    fileName: file.name,
    fileType: getFileExtension(file.name),
  };
}

/** Upload an image data URL (used for ID card capture) via CampusBites Backend. */
export async function uploadImageDataUrl(dataUrl: string): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith("data:image/")) {
    throw new Error("Invalid image capture data format.");
  }

  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const file = new File([blob], "id_card_capture.jpg", { type: "image/jpeg" });

  const uploadResult = await uploadPrintFile(file);
  return uploadResult.url;
}
