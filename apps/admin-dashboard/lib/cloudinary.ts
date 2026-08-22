const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB

/** Upload an advertisement image to Cloudinary (unsigned preset). */
export async function uploadAdImage(file: File): Promise<string> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    console.error("UPLOAD ERROR: Cloudinary credentials missing", { cloudName: Boolean(cloudName), uploadPreset: Boolean(uploadPreset) });
    throw new Error("Cloudinary configuration missing (NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME or NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET not set).");
  }

  if (!file || file.size === 0) {
    throw new Error("Selected image file is 0 bytes (empty file).");
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`Image size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds maximum allowed size of 15MB.`);
  }

  const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  if (file.type && !allowed.includes(file.type) && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
    throw new Error("Please upload a JPG, PNG, or WEBP image.");
  }

  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
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
      throw new Error(`Ad image upload timed out after 35 seconds. Target URL: ${uploadUrl}`);
    }
    throw new Error(`Ad image upload failed at browser level (${err.name || "TypeError"}: ${err.message || "Failed to fetch"}). URL: ${uploadUrl}`);
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
    throw new Error(result.error?.message || "Storage upload succeeded but returned no secure URL.");
  }
  return result.secure_url as string;
}
