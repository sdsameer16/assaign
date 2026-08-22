const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB

/** Upload an advertisement image to Cloudinary (unsigned preset). */
export async function uploadAdImage(file: File): Promise<string> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error("Cloudinary configuration is missing in environment variables.");
  }

  if (!file || file.size === 0) {
    throw new Error("Selected image file is empty.");
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`Image size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds maximum limit of 15MB.`);
  }

  const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  if (file.type && !allowed.includes(file.type) && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
    throw new Error("Please upload a JPG, PNG, or WEBP image.");
  }

  const formData = new FormData();
  formData.append("file", file);
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
      action: "uploadAdImage",
      fileName: file.name,
      fileSize: file.size,
      error: err?.message || err,
    });
    if (err.name === "AbortError") {
      throw new Error("Image upload timed out. Please check your network connection.");
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
      action: "uploadAdImage_error_response",
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
