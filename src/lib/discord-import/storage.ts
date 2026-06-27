import "server-only";

import { buildAssetPublicUrl } from "@/lib/assets";
import { uploadToR2 } from "@/lib/r2";
import { storageKey } from "@/lib/storage";

const DISCORD_CDN = "https://cdn.discordapp.com";

export type DiscordAttachmentInput = {
  id: string;
  url: string;
  fileName: string;
  contentType?: string | null;
  size?: number;
};

export async function downloadDiscordAttachment(
  attachment: DiscordAttachmentInput,
  importId: string
): Promise<{ buffer: Buffer; fileName: string; mimeType: string; r2Key: string; publicUrl: string }> {
  const url = attachment.url.startsWith("http") ? attachment.url : `${DISCORD_CDN}/attachments/${attachment.url}`;
  const res = await fetch(url, { headers: { "User-Agent": "XumariModz-DiscordImport/1.0" } });
  if (!res.ok) {
    throw new Error(`Failed to download ${attachment.fileName} from Discord (${res.status})`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  const safeName = attachment.fileName.replace(/[^\w.-]/g, "_");
  const r2Key = storageKey("discord-imports", importId, `${attachment.id}-${safeName}`);
  const mimeType = attachment.contentType ?? res.headers.get("content-type") ?? "application/octet-stream";

  await uploadToR2(r2Key, buffer, mimeType);

  return {
    buffer,
    fileName: attachment.fileName,
    mimeType,
    r2Key,
    publicUrl: buildAssetPublicUrl(r2Key),
  };
}

/** Rough server-side waveform peaks from raw audio bytes (fallback when Web Audio unavailable). */
export function generateRoughWaveformPeaks(buffer: Buffer, samples = 200): number[] {
  const block = Math.max(1, Math.floor(buffer.length / samples));
  const peaks: number[] = [];
  for (let i = 0; i < samples; i++) {
    const start = i * block;
    let max = 0;
    for (let j = 0; j < block && start + j < buffer.length; j++) {
      const v = Math.abs(buffer[start + j] - 128) / 128;
      if (v > max) max = v;
    }
    peaks.push(max);
  }
  const peakMax = Math.max(...peaks, 0.001);
  return peaks.map((p) => p / peakMax);
}
