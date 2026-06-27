import { getSiteSetting, setSiteSettingSafe } from "@/lib/site-settings";

export type LinkProvider =
  | "direct"
  | "google_drive"
  | "dropbox"
  | "onedrive"
  | "github"
  | "linkvertise"
  | "unknown";

export type DiscordImportSettings = {
  allowedProviders: LinkProvider[];
  allowLinkvertise: boolean;
  maxLinkDownloadMb: number;
};

export const DEFAULT_DISCORD_IMPORT_SETTINGS: DiscordImportSettings = {
  allowedProviders: ["direct", "google_drive", "dropbox", "github"],
  allowLinkvertise: false,
  maxLinkDownloadMb: 500,
};

const KEY = "discord_import_settings";

export async function getDiscordImportSettings(): Promise<DiscordImportSettings> {
  return getSiteSetting(KEY, DEFAULT_DISCORD_IMPORT_SETTINGS);
}

export async function saveDiscordImportSettings(settings: DiscordImportSettings) {
  return setSiteSettingSafe(KEY, settings);
}
