import type { SoundAudioCategory, SoundPreviewType } from "@prisma/client";

export const AUDIO_EXTENSIONS = [".mp3", ".wav", ".ogg", ".flac", ".m4a", ".aac"] as const;

export const SOUND_ARCHIVE_EXTENSIONS = [".zip", ".rar", ".7z"] as const;

export const MAX_PREVIEW_BYTES = 25 * 1024 * 1024;

export const SOUND_CATEGORIES: { value: SoundAudioCategory; labelKey: string }[] = [
  { value: "ENGINE_SOUNDS", labelKey: "engineSounds" },
  { value: "WEAPON_SOUNDS", labelKey: "weaponSounds" },
  { value: "SIRENS", labelKey: "sirens" },
  { value: "UI_SOUNDS", labelKey: "uiSounds" },
  { value: "AMBIENT_SOUNDS", labelKey: "ambientSounds" },
  { value: "RADIO_PACKS", labelKey: "radioPacks" },
  { value: "VOICE_PACKS", labelKey: "voicePacks" },
  { value: "EFFECTS", labelKey: "effects" },
  { value: "MUSIC_PACKS", labelKey: "musicPacks" },
  { value: "CUSTOM_AUDIO", labelKey: "customAudio" },
];

export const PREVIEW_TYPES: { value: SoundPreviewType; labelKey: string; seconds?: number }[] = [
  { value: "FULL", labelKey: "fullPreview" },
  { value: "SECONDS_30", labelKey: "preview30", seconds: 30 },
  { value: "SECONDS_60", labelKey: "preview60", seconds: 60 },
  { value: "CUSTOM", labelKey: "previewCustom" },
];

export function isAudioFileName(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return AUDIO_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function isSoundDownloadFileName(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return (
    isAudioFileName(fileName) ||
    SOUND_ARCHIVE_EXTENSIONS.some((ext) => lower.endsWith(ext))
  );
}

export function formatDuration(seconds?: number | null): string {
  if (seconds == null || seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function getPreviewLimitSeconds(
  previewType: SoundPreviewType,
  customSeconds?: number | null,
  fullDuration?: number | null
): number | null {
  switch (previewType) {
    case "SECONDS_30":
      return 30;
    case "SECONDS_60":
      return 60;
    case "CUSTOM":
      return customSeconds && customSeconds > 0 ? customSeconds : 30;
    case "FULL":
    default:
      return fullDuration ?? null;
  }
}

export async function generateWaveformPeaks(audioBuffer: ArrayBuffer, samples = 200): Promise<number[]> {
  const ctx = new OfflineAudioContext(1, 1, 44100);
  const decoded = await ctx.decodeAudioData(audioBuffer.slice(0));
  const channel = decoded.getChannelData(0);
  const blockSize = Math.floor(channel.length / samples);
  const peaks: number[] = [];
  for (let i = 0; i < samples; i++) {
    const start = i * blockSize;
    let max = 0;
    for (let j = 0; j < blockSize; j++) {
      const v = Math.abs(channel[start + j] ?? 0);
      if (v > max) max = v;
    }
    peaks.push(max);
  }
  const peakMax = Math.max(...peaks, 0.001);
  return peaks.map((p) => p / peakMax);
}

export function downsamplePeaks(peaks: number[], target = 200): number[] {
  if (peaks.length <= target) return peaks;
  const out: number[] = [];
  const ratio = peaks.length / target;
  for (let i = 0; i < target; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.floor((i + 1) * ratio);
    let max = 0;
    for (let j = start; j < end; j++) max = Math.max(max, peaks[j] ?? 0);
    out.push(max);
  }
  return out;
}
