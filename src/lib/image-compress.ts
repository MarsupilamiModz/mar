export async function compressImage(
  file: File,
  quality = 0.85,
  maxWidth = 1920
): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxWidth / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);

      const outputType = file.type === "image/png" ? "image/png" : "image/webp";
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          resolve(new File([blob], file.name.replace(/\.\w+$/, outputType === "image/webp" ? ".webp" : ".png"), {
            type: outputType,
            lastModified: Date.now(),
          }));
        },
        outputType,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}

export function validateImageFile(
  file: File,
  allowedTypes: string[],
  maxSizeMb: number
): string | null {
  if (!allowedTypes.includes(file.type)) {
    return `Invalid type. Allowed: ${allowedTypes.map((t) => t.split("/")[1]).join(", ")}`;
  }
  if (file.size > maxSizeMb * 1024 * 1024) {
    return `File too large. Max ${maxSizeMb}MB`;
  }
  return null;
}
