const IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export type UploadValidationOptions = {
  allowedTypes?: string[];
  maxSizeMb: number;
  label?: string;
};

export type UploadValidationResult =
  | { valid: true; mime: string }
  | { valid: false; error: string };

export function validateUploadFile(
  file: File,
  options: UploadValidationOptions
): UploadValidationResult {
  const allowed = options.allowedTypes ?? Array.from(IMAGE_MIMES);
  const mime = file.type || "application/octet-stream";

  if (!allowed.includes(mime)) {
    const extensions = allowed.map((t) => t.split("/")[1]).join(", ");
    return {
      valid: false,
      error: `${options.label ?? "File"} type not allowed. Use: ${extensions}`,
    };
  }

  const maxBytes = options.maxSizeMb * 1024 * 1024;
  if (file.size <= 0) {
    return { valid: false, error: `${options.label ?? "File"} is empty` };
  }
  if (file.size > maxBytes) {
    return {
      valid: false,
      error: `${options.label ?? "File"} exceeds ${options.maxSizeMb}MB limit`,
    };
  }

  return { valid: true, mime };
}

export function extensionForMime(mime: string): string {
  switch (mime) {
    case "image/webp":
      return "webp";
    case "image/png":
      return "png";
    case "image/gif":
      return "gif";
    case "image/jpeg":
      return "jpg";
    default:
      return "bin";
  }
}
