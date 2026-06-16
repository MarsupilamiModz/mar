import { readFile } from "fs/promises";
import path from "path";
import { getAdSettings } from "@/lib/ads";
import { resolveAdsenseClientId, buildAdsTxtLine, DEFAULT_ADSENSE_CLIENT_ID } from "@/lib/adsense-config";
import { getAppUrl } from "@/lib/app-url";
import { SITE } from "@/lib/site";

export type AdSenseReadinessCheck = {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
};

export type AdSenseReadinessReport = {
  checks: AdSenseReadinessCheck[];
  publisherId: string;
  allOk: boolean;
  warnings: string[];
};

export async function getAdSenseReadinessReport(): Promise<AdSenseReadinessReport> {
  const settings = await getAdSettings();
  const publisherId = resolveAdsenseClientId(settings);
  const checks: AdSenseReadinessCheck[] = [];
  const warnings: string[] = [];

  const scriptEnabled = settings.adsenseGlobalScriptEnabled !== false;
  checks.push({
    id: "script",
    label: "Script configured",
    ok: scriptEnabled && Boolean(publisherId),
    detail: scriptEnabled
      ? `Publisher ${publisherId} — loaded globally via next/script`
      : "Global AdSense script disabled in settings",
  });

  checks.push({
    id: "publisher",
    label: "Publisher ID valid",
    ok: publisherId.startsWith("ca-pub-") && publisherId.length > 10,
    detail: publisherId || "Missing publisher ID",
  });

  let adsTxtOk = false;
  let adsTxtDetail = "Not found";
  try {
    const filePath = path.join(process.cwd(), "public", "ads.txt");
    const content = await readFile(filePath, "utf8");
    const expectedLine = buildAdsTxtLine(publisherId);
    adsTxtOk = content.includes("google.com") && content.includes("pub-");
    adsTxtDetail = adsTxtOk
      ? `/ads.txt present (${content.trim().split("\n").length} line(s))`
      : "ads.txt missing google.com entry";
    if (adsTxtOk && !content.includes(publisherId.replace("ca-pub-", "pub-"))) {
      warnings.push("ads.txt publisher ID may not match current AdSense client ID");
    }
    if (!content.includes(expectedLine.split(",")[1]?.trim() ?? "pub-")) {
      warnings.push(`Expected ads.txt line: ${expectedLine}`);
    }
  } catch {
    adsTxtDetail = "public/ads.txt not readable";
  }

  checks.push({
    id: "ads_txt",
    label: "ads.txt found",
    ok: adsTxtOk,
    detail: adsTxtDetail,
  });

  const appUrl = getAppUrl();
  const httpsOk = appUrl.startsWith("https://");
  checks.push({
    id: "https",
    label: "HTTPS enabled",
    ok: httpsOk || process.env.NODE_ENV !== "production",
    detail: httpsOk ? appUrl : `${appUrl} (use HTTPS in production)`,
  });

  checks.push({
    id: "domain",
    label: "Domain reachable",
    ok: Boolean(SITE.url),
    detail: SITE.url || appUrl,
  });

  checks.push({
    id: "consent",
    label: "Consent Mode v2",
    ok: settings.consentModeEnabled !== false,
    detail:
      settings.consentModeEnabled !== false
        ? "Google Consent Mode default tags active"
        : "Consent mode disabled — enable for GDPR/EU",
  });

  if (!settings.adsenseClientId) {
    warnings.push(`Using default publisher ID ${DEFAULT_ADSENSE_CLIENT_ID}`);
  }

  const allOk = checks.every((c) => c.ok);
  return { checks, publisherId, allOk, warnings };
}
