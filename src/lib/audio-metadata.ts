export type AudioMetadata = {
  durationSeconds: number | null;
  bitrateKbps: number | null;
  mimeType: string;
  sampleRate?: number | null;
};

export function mimeFromAudioFileName(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".ogg")) return "audio/ogg";
  if (lower.endsWith(".flac")) return "audio/flac";
  if (lower.endsWith(".m4a")) return "audio/mp4";
  return "application/octet-stream";
}

export function parseAudioMetadata(
  buffer: Buffer,
  fileName: string,
  contentType?: string | null
): AudioMetadata {
  const mimeType = contentType || mimeFromAudioFileName(fileName);
  const lower = fileName.toLowerCase();

  if (lower.endsWith(".wav") || mimeType.includes("wav")) {
    return parseWav(buffer, mimeType);
  }
  if (lower.endsWith(".flac") || mimeType.includes("flac")) {
    return parseFlac(buffer, mimeType);
  }
  if (lower.endsWith(".mp3") || mimeType.includes("mpeg")) {
    return parseMp3(buffer, mimeType);
  }
  if (lower.endsWith(".ogg") || mimeType.includes("ogg")) {
    return parseOgg(buffer, mimeType);
  }
  if (lower.endsWith(".m4a") || mimeType.includes("mp4") || mimeType.includes("aac")) {
    return parseMp4(buffer, mimeType);
  }

  return { durationSeconds: null, bitrateKbps: null, mimeType };
}

function parseWav(buffer: Buffer, mimeType: string): AudioMetadata {
  if (buffer.length < 44 || buffer.toString("ascii", 0, 4) !== "RIFF") {
    return { durationSeconds: null, bitrateKbps: null, mimeType };
  }
  const sampleRate = buffer.readUInt32LE(24);
  const byteRate = buffer.readUInt32LE(28);
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    if (chunkId === "data") {
      const durationSeconds = byteRate > 0 ? Math.round(chunkSize / byteRate) : null;
      const bitrateKbps = durationSeconds && durationSeconds > 0
        ? Math.round((buffer.length * 8) / durationSeconds / 1000)
        : null;
      return { durationSeconds, bitrateKbps, mimeType, sampleRate };
    }
    offset += 8 + chunkSize;
  }
  return { durationSeconds: null, bitrateKbps: null, mimeType, sampleRate };
}

function parseFlac(buffer: Buffer, mimeType: string): AudioMetadata {
  if (buffer.length < 42 || buffer.toString("ascii", 0, 4) !== "fLaC") {
    return { durationSeconds: null, bitrateKbps: null, mimeType };
  }
  if (buffer.toString("ascii", 4, 8) !== "fLaC" && buffer[0] === 0x66) {
    // already checked fLaC
  }
  let offset = 4;
  while (offset + 4 <= buffer.length) {
    const isLast = (buffer[offset] & 0x80) !== 0;
    const blockType = buffer[offset] & 0x7f;
    const blockSize =
      (buffer[offset + 1] << 16) | (buffer[offset + 2] << 8) | buffer[offset + 3];
    offset += 4;
    if (blockType === 0 && blockSize >= 18 && offset + 18 <= buffer.length) {
      const sampleRateRaw =
        (buffer.readUInt8(offset + 10) << 12) |
        (buffer.readUInt8(offset + 11) << 4) |
        ((buffer.readUInt8(offset + 12) & 0xf0) >> 4);
      const sampleRate = sampleRateRaw || null;
      const sampleNum =
        (buffer.readUInt8(offset + 13) << 24) |
        (buffer.readUInt8(offset + 14) << 16) |
        (buffer.readUInt8(offset + 15) << 8) |
        buffer.readUInt8(offset + 16);
      const durationSeconds =
        sampleRate && sampleNum > 0
          ? Math.round(sampleNum / sampleRate)
          : null;
      const bitrateKbps =
        durationSeconds && durationSeconds > 0
          ? Math.round((buffer.length * 8) / durationSeconds / 1000)
          : null;
      return { durationSeconds, bitrateKbps, mimeType, sampleRate };
    }
    offset += blockSize;
    if (isLast) break;
  }
  return { durationSeconds: null, bitrateKbps: null, mimeType };
}

function parseMp3(buffer: Buffer, mimeType: string): AudioMetadata {
  let start = 0;
  if (buffer.length >= 10 && buffer.toString("ascii", 0, 3) === "ID3") {
    const tagSize =
      ((buffer[6] & 0x7f) << 21) |
      ((buffer[7] & 0x7f) << 14) |
      ((buffer[8] & 0x7f) << 7) |
      (buffer[9] & 0x7f);
    start = 10 + tagSize;
  }

  for (let i = start; i < Math.min(buffer.length - 4, start + 16384); i++) {
    if (buffer[i] === 0xff && (buffer[i + 1] & 0xe0) === 0xe0) {
      const version = (buffer[i + 1] >> 3) & 0x03;
      const layer = (buffer[i + 1] >> 1) & 0x03;
      const bitrateIndex = (buffer[i + 2] >> 4) & 0x0f;
      const sampleRateIndex = (buffer[i + 2] >> 2) & 0x03;
      if (layer !== 0x01 || bitrateIndex === 0 || bitrateIndex === 0x0f || sampleRateIndex === 0x03) {
        continue;
      }
      const bitrates = version === 0x03
        ? [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0]
        : [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];
      const sampleRates = version === 0x03
        ? [44100, 48000, 32000, 0]
        : [22050, 24000, 16000, 0];
      const bitrateKbps = bitrates[bitrateIndex] ?? null;
      const sampleRate = sampleRates[sampleRateIndex] ?? null;
      const durationSeconds =
        bitrateKbps && bitrateKbps > 0
          ? Math.round((buffer.length * 8) / (bitrateKbps * 1000))
          : null;
      return { durationSeconds, bitrateKbps, mimeType, sampleRate };
    }
  }
  return { durationSeconds: null, bitrateKbps: null, mimeType };
}

function parseOgg(buffer: Buffer, mimeType: string): AudioMetadata {
  if (buffer.length < 64 || buffer.toString("ascii", 0, 4) !== "OggS") {
    return { durationSeconds: null, bitrateKbps: null, mimeType };
  }
  let offset = 0;
  let sampleRate: number | null = null;
  let totalSamples = 0;

  while (offset + 27 < buffer.length) {
    if (buffer.toString("ascii", offset, offset + 4) !== "OggS") break;
    const segments = buffer[offset + 26];
    const headerSize = 27 + segments;
    if (offset + headerSize >= buffer.length) break;
    const pageBodyStart = offset + headerSize;
    const ident = buffer.toString("ascii", pageBodyStart, pageBodyStart + 6);
    if (ident === "vorbis" && buffer[pageBodyStart + 7] === 1 && pageBodyStart + 16 <= buffer.length) {
      sampleRate = buffer.readUInt32LE(pageBodyStart + 12);
    }
    const granuleHigh = buffer.readUInt32LE(offset + 10);
    const granuleLow = buffer.readUInt32LE(offset + 6);
    const granule = granuleHigh * 4294967296 + granuleLow;
    if (granule > 0) totalSamples = granule;
    let pageSize = headerSize;
    for (let s = 0; s < segments; s++) {
      pageSize += buffer[offset + 27 + s];
    }
    offset += pageSize;
    if (offset + 5 < buffer.length && (buffer[offset + 5] & 0x04)) break;
  }

  const durationSeconds =
    sampleRate && totalSamples > 0 ? Math.round(totalSamples / sampleRate) : null;
  const bitrateKbps =
    durationSeconds && durationSeconds > 0
      ? Math.round((buffer.length * 8) / durationSeconds / 1000)
      : null;
  return { durationSeconds, bitrateKbps, mimeType, sampleRate };
}

function parseMp4(buffer: Buffer, mimeType: string): AudioMetadata {
  let offset = 0;
  while (offset + 8 <= buffer.length) {
    const size = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    if (size < 8) break;
    if (type === "mvhd" && offset + 28 <= buffer.length) {
      const version = buffer[offset + 8];
      if (version === 0) {
        const timeScale = buffer.readUInt32BE(offset + 20);
        const duration = buffer.readUInt32BE(offset + 24);
        const durationSeconds =
          timeScale > 0 ? Math.round(duration / timeScale) : null;
        const bitrateKbps =
          durationSeconds && durationSeconds > 0
            ? Math.round((buffer.length * 8) / durationSeconds / 1000)
            : null;
        return { durationSeconds, bitrateKbps, mimeType };
      }
    }
    offset += size;
  }
  return { durationSeconds: null, bitrateKbps: null, mimeType };
}
