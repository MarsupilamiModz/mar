import { getAdSettings, getAdProviders, buildProviderScript } from "@/lib/ads";
import { ADSENSE_SCRIPT_ID } from "@/lib/adsense-config";
import Script from "next/script";

/** Secondary ad network scripts (Microsoft, etc.) — AdSense loads globally in root layout. */
export async function AdProviderScripts() {
  const [settings, providers] = await Promise.all([getAdSettings(), getAdProviders()]);

  if (!settings.globalAdsEnabled) return null;

  const scripts: { id: string; html: string }[] = [];

  for (const provider of providers) {
    if (!provider.isEnabled || provider.type === "ADSENSE") continue;
    const config = {
      ...(provider.config as Record<string, string>),
      adsenseClientId: settings.adsenseClientId,
      nitropayId: settings.nitropayId,
      ezoicId: settings.ezoicId,
      microsoftTrackingId: settings.microsoftTrackingId,
    };
    const built = provider.scriptHtml ?? buildProviderScript(provider.type, config);
    if (built) {
      scripts.push({
        id: `ad-provider-${provider.type.toLowerCase()}`,
        html: built.replace(/<\/?script[^>]*>/gi, ""),
      });
    }
  }

  if (scripts.length === 0) return null;

  return (
    <>
      {scripts.map((s) => (
        <Script
          key={s.id}
          id={s.id}
          strategy="lazyOnload"
          dangerouslySetInnerHTML={{ __html: s.html }}
        />
      ))}
      {/* AdSense is loaded once globally — never duplicate */}
      <span id={ADSENSE_SCRIPT_ID} data-loaded="global" className="hidden" aria-hidden />
    </>
  );
}
