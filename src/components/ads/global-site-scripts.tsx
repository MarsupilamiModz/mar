import Script from "next/script";
import { getHeadScriptsSettings, stripScriptTags } from "@/lib/head-scripts";
import { AdSenseScript } from "@/components/ads/adsense-script";
import { GoogleConsentDefault } from "@/components/ads/google-consent-mode";
import { CookieConsentBanner } from "@/components/ads/cookie-consent-banner";
import { shouldLoadGlobalAdSense } from "@/components/ads/global-site-ads";

export async function GlobalSiteScripts() {
  const [{ load, clientId, consentMode }, headScripts] = await Promise.all([
    shouldLoadGlobalAdSense(),
    getHeadScriptsSettings(),
  ]);

  const bodyScripts = headScripts.scriptSnippets.filter(
    (s) => s.enabled && s.placement === "body"
  );
  const headScriptsEnabled = headScripts.scriptSnippets.filter(
    (s) => s.enabled && s.placement === "head"
  );

  return (
    <>
      {consentMode && <GoogleConsentDefault />}
      {load && <AdSenseScript clientId={clientId} />}
      {headScriptsEnabled.map((snippet) => (
        <Script
          key={snippet.id}
          id={`head-script-${snippet.id}`}
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{ __html: stripScriptTags(snippet.html) }}
        />
      ))}
      {bodyScripts.map((snippet) => (
        <Script
          key={snippet.id}
          id={`body-script-${snippet.id}`}
          strategy="lazyOnload"
          dangerouslySetInnerHTML={{ __html: stripScriptTags(snippet.html) }}
        />
      ))}
      {consentMode && <CookieConsentBanner />}
    </>
  );
}
