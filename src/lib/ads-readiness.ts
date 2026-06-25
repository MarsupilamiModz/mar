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
  lastCheckedAt: string;
  adsTxtUrl: string;
  adsTxtReachable: boolean;
};

export async function getAdSenseReadinessReport(): Promise<AdSenseReadinessReport> {
  const settings = await getAdSettings();
  const publisherId = resolveAdsenseClientId(settings);
  const checks: AdSenseReadinessCheck[] = [];
  const warnings: string[] = [];
  const lastCheckedAt = new Date().toISOString();
  const appUrl = getAppUrl();
  const adsTxtUrl = `${appUrl.replace(/\/$/, "")}/ads.txt`;

  const scriptEnabled = settings.adsenseGlobalScriptEnabled !== false;
  checks.push({
    id: "script",
    label: "AdSense script configured",
    ok: scriptEnabled && Boolean(publisherId),
    detail: scriptEnabled
      ? `Publisher ${publisherId} — loaded globally`
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
  let adsTxtReachable = false;

  try {
    const filePath = path.join(process.cwd(), "public", "ads.txt");
    const content = await readFile(filePath, "utf8");
    const expectedLine = buildAdsTxtLine(publisherId);
    adsTxtOk = content.includes("google.com") && content.includes("pub-");
    adsTxtDetail = adsTxtOk
      ? `public/ads.txt (${content.trim().split("\n").length} line(s))`
      : "ads.txt missing google.com entry";
    if (adsTxtOk && !content.includes(publisherId.replace("ca-pub-", "pub-"))) {
      warnings.push("ads.txt publisher ID may not match current AdSense client ID");
    }
    if (!content.trim().includes(expectedLine)) {
      warnings.push(`Expected: ${expectedLine}`);
    }
  } catch {
    adsTxtDetail = "public/ads.txt not readable — save AdSense settings to regenerate";
  }

  try {
    const res = await fetch(adsTxtUrl, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const body = await res.text();
      adsTxtReachable = body.includes("google.com") && body.includes("pub-");
      if (adsTxtReachable) {
        adsTxtOk = true;
        adsTxtDetail = `Live ${adsTxtUrl} reachable`;
      } else {
        warnings.push("Live ads.txt response missing google.com publisher line");
      }
    } else {
      warnings.push(`Live ads.txt returned HTTP ${res.status}`);
    }
  } catch {
    warnings.push(`Could not fetch live ${adsTxtUrl} — verify nginx/static serving`);
  }

  checks.push({
    id: "ads_txt",
    label: "ads.txt reachable",
    ok: adsTxtOk && adsTxtReachable,
    detail: adsTxtDetail,
  });

  checks.push({
    id: "ads_txt_live",
    label: "No auth redirect on ads.txt",
    ok: adsTxtReachable,
    detail: adsTxtReachable ? "Public text response confirmed" : "Fetch failed or blocked",
  });

  const httpsOk = appUrl.startsWith("https://");
  checks.push({
    id: "https",
    label: "HTTPS enabled",
    ok: httpsOk || process.env.NODE_ENV !== "production",
    detail: httpsOk ? appUrl : `${appUrl} (use HTTPS in production)`,
  });

  checks.push({
    id: "domain",
    label: "Domain configured",
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
  return { checks, publisherId, allOk, warnings, lastCheckedAt, adsTxtUrl, adsTxtReachable };
}
