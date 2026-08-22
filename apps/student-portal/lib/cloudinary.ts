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
    console.error("UPLOAD ERROR: Cloudinary credentials missing", { cloudName: Boolean(cloudName), uploadPreset: Boolean(uploadPreset) });
    throw new Error("Cloudinary configuration missing (NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME or NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET not set).");
  }

  if (!file || file.size === 0) {
    throw new Error("Selected file is 0 bytes (empty file).");
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds maximum allowed upload size of 15MB.`);
  }

  if (!isAcceptedPrintFile(file.name)) {
    throw new Error(
      "Unsupported file type. Accepted formats: pdf, doc, docx, xls, xlsx, jpeg, jpg, png",
    );
  }

  const resourceType = resourceTypeForPrintFile(file.name);
  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 35000);

  let response: Response;
  try {
    response = await fetch(uploadUrl, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });
  } catch (err: any) {
    console.error("UPLOAD ERROR:", err);
    console.error("UPLOAD URL:", uploadUrl);
    console.error("FILE DETAILS:", { name: file.name, size: file.size, type: file.type });

    if (err.name === "AbortError") {
      throw new Error(`Upload request timed out after 35 seconds. Target URL: ${uploadUrl}`);
    }
    throw new Error(`Upload request failed at browser/transport level (${err.name || "TypeError"}: ${err.message || "Failed to fetch"}). URL: ${uploadUrl}`);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errRes = await response.json().catch(() => ({}));
    const errorMessage = errRes.error?.message || response.statusText || "Unknown storage error";
    console.error("UPLOAD HTTP ERROR:", {
      url: uploadUrl,
      status: response.status,
      statusText: response.statusText,
      cloudError: errRes.error,
      file: { name: file.name, size: file.size, type: file.type },
    });
    throw new Error(`Storage upload failed: HTTP ${response.status} - ${errorMessage}`);
  }

  const result = await response.json();
  if (!result.secure_url) {
    throw new Error(result.error?.message || "Storage upload succeeded but returned no secure URL.");
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
    console.error("UPLOAD ERROR: Cloudinary credentials missing", { cloudName: Boolean(cloudName), uploadPreset: Boolean(uploadPreset) });
    throw new Error("Cloudinary configuration missing in environment variables.");
  }

  if (!dataUrl || !dataUrl.startsWith("data:image/")) {
    throw new Error("Invalid image capture data format.");
  }

  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
  const formData = new FormData();
  formData.append("file", dataUrl);
  formData.append("upload_preset", uploadPreset);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 35000);

  let response: Response;
  try {
    response = await fetch(uploadUrl, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });
  } catch (err: any) {
    console.error("UPLOAD ERROR:", err);
    console.error("UPLOAD URL:", uploadUrl);
    console.error("DATA URL LENGTH:", dataUrl.length);

    if (err.name === "AbortError") {
      throw new Error(`ID image upload timed out after 35 seconds. Target URL: ${uploadUrl}`);
    }
    throw new Error(`ID image upload failed at browser level (${err.name || "TypeError"}: ${err.message || "Failed to fetch"}). URL: ${uploadUrl}`);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errRes = await response.json().catch(() => ({}));
    const errorMessage = errRes.error?.message || response.statusText || "Unknown storage error";
    console.error("UPLOAD HTTP ERROR:", {
      url: uploadUrl,
      status: response.status,
      cloudError: errRes.error,
    });
    throw new Error(`Storage upload failed: HTTP ${response.status} - ${errorMessage}`);
  }

  const result = await response.json();
  if (!result.secure_url) {
    throw new Error(result.error?.message || "Storage upload succeeded but returned no file URL.");
  }
  return result.secure_url as string;
}
