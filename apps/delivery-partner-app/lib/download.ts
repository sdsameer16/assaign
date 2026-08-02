/** Force download for Cloudinary assets (fixes PDF image/upload viewer failures). */
export function cloudinaryDownloadUrl(url: string, _fileName?: string): string {
  if (!url || !url.includes("/upload/")) return url;
  // Named fl_attachment:filename returns 400 on raw uploads; bare flag is valid.
  if (url.includes("fl_attachment")) {
    return url.replace(/fl_attachment:[^/]+/, "fl_attachment");
  }
  return url.replace("/upload/", "/upload/fl_attachment/");
}

/** Download a print file as a blob (falls back to opening attachment URL). */
export async function downloadPrintFile(
  url: string,
  fileName: string,
): Promise<void> {
  const downloadUrl = cloudinaryDownloadUrl(url, fileName);
  try {
    const res = await fetch(downloadUrl, { mode: "cors" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = fileName || "print-file";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    const fallback = cloudinaryDownloadUrl(url);
    window.open(fallback, "_blank", "noopener,noreferrer");
  }
}
