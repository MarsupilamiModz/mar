import { writeFileSync, mkdirSync } from "fs";
import path from "path";
import { buildAdsTxtLine, resolveAdsenseClientId } from "@/lib/adsense-config";
import type { AdProviderSettings } from "@/lib/ads";

export function writeAdsTxtFile(settings?: AdProviderSettings) {
  const publisherId = resolveAdsenseClientId(settings);
  const content = `${buildAdsTxtLine(publisherId)}\n`;
  const publicDir = path.join(process.cwd(), "public");
  mkdirSync(publicDir, { recursive: true });
  writeFileSync(path.join(publicDir, "ads.txt"), content, "utf8");
  return content.trim();
}
