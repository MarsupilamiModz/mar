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
  toFormat(format: string, options?: { quality?: number; effort?: number }): SharpInstance;
  toBuffer(): Promise<Buffer>;
};

async function loadSharp(): Promise<((input: Buffer) => SharpInstance) | null> {
  try {
    const mod = (await import(/* webpackIgnore: true */ "sharp" as string)) as {
      default: (input: Buffer) => SharpInstance;
    };
    return mod.default;
  } catch {
    return null;
  }
}

function extForMime(contentType: string): { ext: string; mime: string } {
  if (contentType.includes("png")) return { ext: "png", mime: "image/png" };
  if (contentType.includes("gif")) return { ext: "gif", mime: "image/gif" };
  if (contentType.includes("svg")) return { ext: "svg", mime: "image/svg+xml" };
  if (contentType.includes("jpeg") || contentType.includes("jpg")) {
    return { ext: "jpg", mime: "image/jpeg" };
  }
  return { ext: "webp", mime: "image/webp" };
}

export async function generateAvatarVariants(
  sourceBuffer: Buffer,
  userId: string,
  contentType: string
): Promise<AvatarVariants> {
  const { ext, mime } = extForMime(contentType);
  const baseKey = storageKey("avatars", userId);
  const originalKey = `${baseKey}/original.${ext}`;

  const sharp = await loadSharp();
  await uploadToR2(originalKey, sourceBuffer, mime);

  const urls: Record<string, string> = {
    original: buildAssetPublicUrl(originalKey),
  };

  if (sharp && !contentType.includes("svg")) {
    for (const size of SIZES) {
      const webpKey = `${baseKey}/avatar_${size}.webp`;
      const avifKey = `${baseKey}/avatar_${size}.avif`;

      const webpBuffer = await sharp(sourceBuffer)
        .rotate()
        .resize(size, size, { fit: "cover", position: "centre" })
        .toFormat("webp", { quality: 85 })
        .toBuffer();
      await uploadToR2(webpKey, webpBuffer, "image/webp");

      try {
        const avifBuffer = await sharp(sourceBuffer)
          .rotate()
          .resize(size, size, { fit: "cover", position: "centre" })
          .toFormat("avif", { quality: 70, effort: 4 })
          .toBuffer();
        await uploadToR2(avifKey, avifBuffer, "image/avif");
      } catch {
        /* AVIF unsupported in this sharp build */
      }

      urls[`avatar${size}`] = buildAssetPublicUrl(webpKey);
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
