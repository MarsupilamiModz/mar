/** Default Xumari Modz AdSense publisher ID */
export const DEFAULT_ADSENSE_CLIENT_ID = "ca-pub-2447024569426125";

export const ADSENSE_SCRIPT_ID = "google-adsense";
export const GOOGLE_CONSENT_SCRIPT_ID = "google-consent-default";

export function normalizeAdsenseClientId(value: string | undefined | null): string | null {
  const v = value?.trim();
  if (!v) return null;
  if (v.startsWith("ca-pub-")) return v;
  if (/^\d+$/.test(v)) return `ca-pub-${v}`;
  return v.includes("pub-") ? v : null;
}

export function resolveAdsenseClientId(settings?: { adsenseClientId?: string }): string {
  return (
    normalizeAdsenseClientId(settings?.adsenseClientId) ??
    normalizeAdsenseClientId(process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID) ??
    normalizeAdsenseClientId(process.env.ADSENSE_CLIENT_ID) ??
    DEFAULT_ADSENSE_CLIENT_ID
  );
}

export function buildAdsTxtLine(publisherId: string): string {
  const id = publisherId.replace(/^ca-pub-/, "");
  return `google.com, pub-${id}, DIRECT, f08c47fec0942fa0`;
}

export const DEFAULT_ADS_TXT = buildAdsTxtLine(DEFAULT_ADSENSE_CLIENT_ID);

export function adsenseScriptUrl(clientId: string): string {
  return `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`;
}
