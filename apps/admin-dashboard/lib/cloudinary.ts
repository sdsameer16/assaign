/** Upload an advertisement image to Cloudinary (unsigned preset). */
export async function uploadAdImage(file: File): Promise<string> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error("Cloudinary configuration is missing in environment variables.");
  }

  const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  if (file.type && !allowed.includes(file.type) && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
    throw new Error("Please upload a JPG, PNG, or WEBP image.");
  }

  const formData = new FormData();
  formData.append("file", file);
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
