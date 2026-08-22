const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB

const getBackendApiUrl = (): string => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl && envUrl.trim() !== "") {
    return envUrl.trim().replace(/\/+$/, "");
  }
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return "http://localhost:8080/api/admin";
    }
    const protocol = window.location.protocol === "https:" ? "https:" : "http:";
    return `${protocol}//${window.location.host}/api/admin`;
  }
  return "http://localhost:8080/api/admin";
};

/** Upload an advertisement image via CampusBites Backend API. */
export async function uploadAdImage(file: File): Promise<string> {
  if (!file || file.size === 0) {
    throw new Error("Selected image file is 0 bytes (empty file).");
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error("Image size exceeds maximum allowed size of 15MB.");
  }

  const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  if (file.type && !allowed.includes(file.type) && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
    throw new Error("Please upload a JPG, PNG, or WEBP image.");
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
    console.error("[Admin Upload Transport Error]", {
      url: uploadUrl,
      fileName: file.name,
      fileSize: file.size,
      error: err?.message || err,
    });
    throw new Error("Unable to connect to CampusBites admin server. Please check your connection.");
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errRes = await response.json().catch(() => ({}));
    const errorMsg = errRes.error || response.statusText;
    console.error("[Admin Upload HTTP Error]", {
      url: uploadUrl,
      status: response.status,
      error: errorMsg,
    });
    if (response.status === 413) {
      throw new Error("File is too large.");
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error("Upload authorization failed.");
    }
    throw new Error("CampusBites could not process the image. Please try again.");
  }

  const result = await response.json();
  if (!result.url) {
    throw new Error("CampusBites could not process the image. Please try again.");
  }
  return result.url as string;
}
