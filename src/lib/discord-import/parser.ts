import type { DiscordImportType } from "@prisma/client";

export type ParsedAttachmentRole =
  | "primary"
  | "screenshot"
  | "preview"
  | "video"
  | "audio"
  | "attachment";

export type ParsedDiscordMessage = {
  importType: DiscordImportType;
  title: string;
  description: string;
  tags: string[];
  links: string[];
  referencedFiles: string[];
};

const ARCHIVE_EXT = [".zip", ".rar", ".7z"];
const IMAGE_EXT = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"];
const AUDIO_EXT = [".mp3", ".wav", ".ogg", ".flac", ".m4a", ".aac"];
const VIDEO_EXT = [".mp4", ".mov", ".webm", ".mkv"];

export function extensionOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

export function classifyAttachment(fileName: string, importType: DiscordImportType): ParsedAttachmentRole {
  const ext = extensionOf(fileName);
  if (AUDIO_EXT.includes(ext)) return importType === "SOUND" ? "primary" : "audio";
  if (ARCHIVE_EXT.includes(ext)) return "primary";
  if (IMAGE_EXT.includes(ext)) return importType === "GALLERY" ? "primary" : "screenshot";
  if (VIDEO_EXT.includes(ext)) return "video";
  return "attachment";
}

const TYPE_TAGS: Record<string, DiscordImportType> = {
  MOD: "MOD",
  SOUND: "SOUND",
  COLLECTION: "COLLECTION",
  NEWS: "NEWS",
  GALLERY: "GALLERY",
};

export function parseDiscordMessageContent(
  content: string,
  fallbackType: DiscordImportType
): ParsedDiscordMessage {
  const lines = content.replace(/\r/g, "").split("\n").map((l) => l.trim());
  const tags: string[] = [];
  const links: string[] = [];
  const referencedFiles: string[] = [];

  let importType = fallbackType;
  let title = "";
  const descLines: string[] = [];
  let section: "body" | "description" | "files" | "images" | "tags" | "links" = "body";

  for (const raw of lines) {
    if (!raw) continue;

    const tagMatch = raw.match(/^\[(MOD|SOUND|COLLECTION|NEWS|GALLERY)\]$/i);
    if (tagMatch) {
      importType = TYPE_TAGS[tagMatch[1].toUpperCase()] ?? fallbackType;
      continue;
    }

    const inlineTag = raw.match(/^\[(MOD|SOUND|COLLECTION|NEWS|GALLERY)\]\s*(.+)$/i);
    if (inlineTag) {
      importType = TYPE_TAGS[inlineTag[1].toUpperCase()] ?? fallbackType;
      title = inlineTag[2].trim();
      continue;
    }

    const lower = raw.toLowerCase();
    if (/^(beschreibung|description):?$/i.test(raw)) {
      section = "description";
      continue;
    }
    if (/^(datei|file|download):?$/i.test(raw)) {
      section = "files";
      continue;
    }
    if (/^(bilder|images|screenshots):?$/i.test(raw)) {
      section = "images";
      continue;
    }
    if (/^(tags|tag):?$/i.test(raw)) {
      section = "tags";
      continue;
    }

    const urlMatch = raw.match(/https?:\/\/[^\s]+/g);
    if (urlMatch) links.push(...urlMatch);

    if (section === "tags") {
      tags.push(...raw.split(/[,#]/).map((t) => t.trim()).filter(Boolean));
      continue;
    }
    if (section === "files" || section === "images") {
      referencedFiles.push(...raw.split(/[,;\s]+/).filter(Boolean));
      continue;
    }
    if (section === "description") {
      descLines.push(raw);
      continue;
    }
    if (!title && section === "body" && !lower.startsWith("http")) {
      title = raw;
      section = "description";
      continue;
    }
    descLines.push(raw);
  }

  return {
    importType,
    title: title || "Untitled import",
    description: descLines.join("\n").trim(),
    tags: Array.from(new Set(tags)),
    links: Array.from(new Set(links)),
    referencedFiles,
  };
}

export function channelNameToGameSlug(channelName: string): string | null {
  const normalized = channelName.toLowerCase().replace(/^#/, "").trim();
  const map: Record<string, string> = {
    ragemp: "ragemp",
    rage: "ragemp",
    fivem: "fivem",
    singleplayer: "singleplayer",
    sp: "singleplayer",
    redux: "redux",
    revo: "revo",
  };
  return map[normalized] ?? null;
}

export function inferImportTypeFromChannelName(channelName: string): DiscordImportType | null {
  const n = channelName.toLowerCase().replace(/^#/, "");
  if (n.includes("mod")) return "MOD";
  if (n.includes("sound")) return "SOUND";
  if (n.includes("collection")) return "COLLECTION";
  if (n.includes("news")) return "NEWS";
  if (n.includes("screenshot") || n.includes("gallery") || n.includes("media")) return "GALLERY";
  return null;
}
