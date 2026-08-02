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

  if (!isAcceptedPrintFile(file.name)) {
    throw new Error(
      "Unsupported file type. Accepted: pdf, doc, docx, xls, xlsx, jpeg, jpg, png",
    );
  }

  const resourceType = resourceTypeForPrintFile(file.name);
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);

  let response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
    {
      method: "POST",
      body: formData,
    },
  );

  // Some unsigned presets only allow "image"; fall back to auto for docs.
  if (!response.ok && resourceType === "raw") {
    const retryData = new FormData();
    retryData.append("file", file);
    retryData.append("upload_preset", uploadPreset);
    response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
      {
        method: "POST",
        body: retryData,
      },
    );
  }

  if (!response.ok) {
    const errRes = await response.json().catch(() => ({}));
    throw new Error(
      errRes.error?.message || `Cloudinary upload failed (${response.status})`,
    );
  }

  const result = await response.json();
  if (!result.secure_url) {
    throw new Error(result.error?.message || "Upload failed");
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

  const formData = new FormData();
  formData.append("file", dataUrl);
  formData.append("upload_preset", uploadPreset);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    {
      method: "POST",
      body: formData,
    },
  );

  if (!response.ok) {
    const errRes = await response.json().catch(() => ({}));
    throw new Error(
      errRes.error?.message || `Cloudinary upload failed (${response.status})`,
    );
  }

  const result = await response.json();
  if (!result.secure_url) {
    throw new Error(result.error?.message || "Upload failed");
  }
  return result.secure_url as string;
}
