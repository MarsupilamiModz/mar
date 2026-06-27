import { buildAssetPublicUrl } from "@/lib/assets";
import { uploadToR2 } from "@/lib/r2";
import { storageKey } from "@/lib/storage";

type SharpInstance = {
  rotate(): SharpInstance;
  resize(width: number, height: number, options: { fit: string; withoutEnlargement?: boolean }): SharpInstance;
  webp(options: { quality: number }): SharpInstance;
  avif(options: { quality: number; effort?: number }): SharpInstance;
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

const SIZE_PRESETS: Record<string, { width: number; height: number }> = {
  RECT_300x250: { width: 300, height: 250 },
  LEADERBOARD_728x90: { width: 728, height: 90 },
  BILLBOARD_970x250: { width: 970, height: 250 },
  RESPONSIVE: { width: 1200, height: 400 },
};

export async function processHostingBannerUpload(input: {
  partnerId: string;
  bannerId: string;
  buffer: Buffer;
  contentType: string;
  size: keyof typeof SIZE_PRESETS;
}) {
  const sharp = await loadSharp();
  const preset = SIZE_PRESETS[input.size] ?? SIZE_PRESETS.RESPONSIVE;
  const baseKey = storageKey("banners", "hosting", input.partnerId, input.bannerId);

  let originalBuffer = input.buffer;
  let webpBuffer: Buffer | null = null;
  let avifBuffer: Buffer | null = null;

  if (sharp) {
    const pipeline = sharp(input.buffer).rotate().resize(preset.width, preset.height, {
      fit: "inside",
      withoutEnlargement: true,
    });
    originalBuffer = await pipeline.webp({ quality: 88 }).toBuffer();
    webpBuffer = originalBuffer;
    avifBuffer = await sharp(input.buffer)
      .rotate()
      .resize(preset.width, preset.height, { fit: "inside", withoutEnlargement: true })
      .avif({ quality: 75, effort: 4 })
      .toBuffer();
  }

  const ext = sharp ? "webp" : "jpg";
  const imageKey = `${baseKey}.${ext}`;
  const webpKey = webpBuffer ? `${baseKey}.webp` : null;
  const avifKey = avifBuffer ? `${baseKey}.avif` : null;

  await uploadToR2(imageKey, originalBuffer, sharp ? "image/webp" : input.contentType);
  if (webpBuffer && webpKey) await uploadToR2(webpKey, webpBuffer, "image/webp");
  if (avifBuffer && avifKey) await uploadToR2(avifKey, avifBuffer, "image/avif");

  return {
    imageUrl: buildAssetPublicUrl(imageKey),
    webpUrl: webpKey ? buildAssetPublicUrl(webpKey) : null,
    avifUrl: avifKey ? buildAssetPublicUrl(avifKey) : null,
  };
}
