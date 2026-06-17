import "server-only";

import { buildAssetPublicUrl } from "@/lib/assets";
import { uploadToR2 } from "@/lib/r2";
import { storageKey } from "@/lib/storage";

export type AvatarVariants = {
  original: string;
  avatar256: string;
  avatar128: string;
  avatar64: string;
};

const SIZES = [64, 128, 256] as const;

type SharpInstance = {
  rotate(): SharpInstance;
  resize(width: number, height: number, options: { fit: string; position: string }): SharpInstance;
  toFormat(format: string, options: { quality: number }): SharpInstance;
  toBuffer(): Promise<Buffer>;
};

async function loadSharp(): Promise<((input: Buffer) => SharpInstance) | null> {
  try {
    const mod = await import(
      /* webpackIgnore: true */ "sharp" as string
    ) as { default: (input: Buffer) => SharpInstance };
    return mod.default;
  } catch {
    return null;
  }
}

export async function generateAvatarVariants(
  sourceBuffer: Buffer,
  userId: string,
  contentType: string
): Promise<AvatarVariants> {
  const ext = contentType.includes("png") ? "png" : "webp";
  const mime = ext === "png" ? "image/png" : "image/webp";
  const baseKey = storageKey("avatars", userId);
  const originalKey = `${baseKey}/original.${ext}`;

  const sharp = await loadSharp();

  await uploadToR2(originalKey, sourceBuffer, contentType);

  const urls: Record<string, string> = {
    original: buildAssetPublicUrl(originalKey),
  };

  if (sharp) {
    for (const size of SIZES) {
      const key = `${baseKey}/avatar_${size}.${ext}`;
      const resized = await sharp(sourceBuffer)
        .rotate()
        .resize(size, size, { fit: "cover", position: "centre" })
        .toFormat(ext === "png" ? "png" : "webp", { quality: 85 })
        .toBuffer();

      await uploadToR2(key, resized, mime);
      urls[`avatar${size}`] = buildAssetPublicUrl(key);
    }
  } else {
    for (const size of SIZES) {
      urls[`avatar${size}`] = urls.original;
    }
  }

  return {
    original: urls.original,
    avatar256: urls.avatar256 ?? urls.original,
    avatar128: urls.avatar128 ?? urls.original,
    avatar64: urls.avatar64 ?? urls.original,
  };
}
