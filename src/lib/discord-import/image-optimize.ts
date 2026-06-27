import { buildAssetPublicUrl } from "@/lib/assets";
import { uploadToR2 } from "@/lib/r2";
import { storageKey } from "@/lib/storage";

type SharpInstance = {
  rotate(): SharpInstance;
  webp(options: { quality: number }): SharpInstance;
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

export async function optimizeImageToWebp(
  buffer: Buffer,
  importId: string,
  baseName: string
): Promise<{ buffer: Buffer; fileName: string; mimeType: string; r2Key: string; publicUrl: string }> {
  const sharp = await loadSharp();
  const safeBase = baseName.replace(/\.[^.]+$/, "").replace(/[^\w.-]/g, "_");
  const fileName = `${safeBase}.webp`;
  const r2Key = storageKey("discord-imports", importId, "screenshots", fileName);

  let out = buffer;
  let mimeType = "image/webp";

  if (sharp) {
    out = await sharp(buffer).rotate().webp({ quality: 85 }).toBuffer();
  } else {
    mimeType = "application/octet-stream";
  }

  await uploadToR2(r2Key, out, mimeType);

  return {
    buffer: out,
    fileName,
    mimeType,
    r2Key,
    publicUrl: buildAssetPublicUrl(r2Key),
  };
}

export function isImageFileName(name: string): boolean {
  return /\.(png|jpe?g|webp|gif|avif)$/i.test(name);
}

export function isImageMime(mime: string): boolean {
  return mime.startsWith("image/");
}
