const ACCEPTED_PRINT_EXTENSIONS = [
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "jpeg",
  "jpg",
  "png",
] as const;

const IMAGE_EXTENSIONS = new Set(["jpeg", "jpg", "png"]);

export type AcceptedPrintExtension = (typeof ACCEPTED_PRINT_EXTENSIONS)[number];

export function getFileExtension(fileName: string): string {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
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

/** Upload a document/image to Cloudinary (raw for docs, image for photos). */
export async function uploadPrintFile(file: File): Promise<{
  url: string;
  fileName: string;
  fileType: string;
}> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error("Cloudinary configuration is missing in environment variables.");
  }

  if (!file || file.size === 0) {
    throw new Error("Selected file is empty.");
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds maximum limit of 15MB.`);
  }

  if (!isAcceptedPrintFile(file.name)) {
    throw new Error(
      "Unsupported file type. Accepted: pdf, doc, docx, xls, xlsx, jpeg, jpg, png",
    );
  }

  const resourceType = resourceTypeForPrintFile(file.name);
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 35000);

  let response: Response;
  try {
    response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
      {
        method: "POST",
        body: formData,
        signal: controller.signal,
      },
    );
  } catch (netErr: any) {
    console.error("[Upload Diagnostic]", {
      action: "uploadPrintFile_primary",
      fileName: file.name,
      fileSize: file.size,
      resourceType,
      error: netErr?.message || netErr,
    });

    // If primary upload attempt failed at network layer and it was a raw resource, retry with 'auto'
    if (resourceType === "raw") {
      try {
        const retryData = new FormData();
        retryData.append("file", file);
        retryData.append("upload_preset", uploadPreset);
        const retryController = new AbortController();
        const retryTimeoutId = setTimeout(() => retryController.abort(), 35000);
        response = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
          {
            method: "POST",
            body: retryData,
            signal: retryController.signal,
          },
        );
        clearTimeout(retryTimeoutId);
      } catch (retryErr: any) {
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          throw new Error("Network unavailable. Please check your internet connection and try again.");
        }
        throw new Error("File upload failed due to network connectivity issues. Please try again.");
      }
    } else {
      if (netErr.name === "AbortError") {
        throw new Error("Upload timed out. Please check your internet connection.");
      }
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        throw new Error("Network unavailable. Please check your internet connection.");
      }
      throw new Error("File upload failed due to network connectivity issues. Please try again.");
    }
  } finally {
    clearTimeout(timeoutId);
  }

  // Some unsigned presets only allow "image"; fall back to auto for docs.
  if (!response.ok && resourceType === "raw") {
    try {
      const retryData = new FormData();
      retryData.append("file", file);
      retryData.append("upload_preset", uploadPreset);
      const retryController = new AbortController();
      const retryTimeout = setTimeout(() => retryController.abort(), 35000);
      response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
        {
          method: "POST",
          body: retryData,
          signal: retryController.signal,
        },
      );
      clearTimeout(retryTimeout);
    } catch (fallbackErr: any) {
      console.error("[Upload Diagnostic]", {
        action: "uploadPrintFile_fallback",
        fileName: file.name,
        error: fallbackErr?.message || fallbackErr,
      });
    }
  }

  if (!response.ok) {
    const errRes = await response.json().catch(() => ({}));
    console.error("[Upload Diagnostic]", {
      action: "uploadPrintFile_error_response",
      status: response.status,
      errorResponse: errRes,
    });
    throw new Error(
      errRes.error?.message || `Storage upload failed (Status: ${response.status})`,
    );
  }

  const result = await response.json();
  if (!result.secure_url) {
    throw new Error(result.error?.message || "Storage upload succeeded but returned no file URL.");
  }

  return {
    url: result.secure_url as string,
    fileName: file.name,
    fileType: getFileExtension(file.name),
  };
}

/** Upload an image data URL (used for ID card capture). */
export async function uploadImageDataUrl(dataUrl: string): Promise<string> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error("Cloudinary configuration is missing in environment variables.");
  }

  if (!dataUrl || !dataUrl.startsWith("data:image/")) {
    throw new Error("Invalid image data capture.");
  }

  const formData = new FormData();
  formData.append("file", dataUrl);
  formData.append("upload_preset", uploadPreset);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 35000);

  let response: Response;
  try {
    response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: "POST",
        body: formData,
        signal: controller.signal,
      },
    );
  } catch (err: any) {
    console.error("[Upload Diagnostic]", {
      action: "uploadImageDataUrl",
      dataLength: dataUrl.length,
      error: err?.message || err,
    });
    if (err.name === "AbortError") {
      throw new Error("Image upload timed out. Please try again.");
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      throw new Error("Network unavailable. Please check your internet connection.");
    }
    throw new Error("Image upload failed due to network connectivity issues.");
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errRes = await response.json().catch(() => ({}));
    console.error("[Upload Diagnostic]", {
      action: "uploadImageDataUrl_error_response",
      status: response.status,
      errorResponse: errRes,
    });
    throw new Error(
      errRes.error?.message || `Storage upload failed (Status: ${response.status})`,
    );
  }

  const result = await response.json();
  if (!result.secure_url) {
    throw new Error(result.error?.message || "Storage upload failed");
  }
  return result.secure_url as string;
}
