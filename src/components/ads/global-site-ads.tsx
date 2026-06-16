import { getAdSettings } from "@/lib/ads";
import { resolveAdsenseClientId } from "@/lib/adsense-config";
import { getSiteVerificationSettings } from "@/lib/site-verification";
import { getHeadScriptsSettings } from "@/lib/head-scripts";
import type { VerificationMetaTag } from "@/lib/site-verification";
import type { HeadMetaTag } from "@/lib/head-scripts";

export async function GlobalSiteHead() {
  const [verification, headScripts] = await Promise.all([
    getSiteVerificationSettings(),
    getHeadScriptsSettings(),
  ]);

  return (
    <>
      {verification.googleSiteVerification && (
        <meta name="google-site-verification" content={verification.googleSiteVerification} />
      )}
      {verification.googleAdsenseVerification && (
        <meta name="google-adsense-account" content={verification.googleAdsenseVerification} />
      )}
      {verification.bingSiteVerification && (
        <meta name="msvalidate.01" content={verification.bingSiteVerification} />
      )}
      {verification.yandexVerification && (
        <meta name="yandex-verification" content={verification.yandexVerification} />
      )}
      {verification.pinterestVerification && (
        <meta name="p:domain_verify" content={verification.pinterestVerification} />
      )}
      {verification.customMetaTags.map((tag: VerificationMetaTag) =>
        tag.property ? (
          <meta key={tag.id} property={tag.property} content={tag.content} />
        ) : tag.name ? (
          <meta key={tag.id} name={tag.name} content={tag.content} />
        ) : null
      )}
      {headScripts.metaTags.map((tag: HeadMetaTag) =>
        tag.property ? (
          <meta key={tag.id} property={tag.property} content={tag.content} />
        ) : tag.name ? (
          <meta key={tag.id} name={tag.name} content={tag.content} />
        ) : null
      )}
    </>
  );
}

export async function shouldLoadGlobalAdSense(): Promise<{
  load: boolean;
  clientId: string;
  consentMode: boolean;
}> {
  const settings = await getAdSettings();
  const clientId = resolveAdsenseClientId(settings);
  const load = settings.adsenseGlobalScriptEnabled !== false && Boolean(clientId);

  return {
    load,
    clientId,
    consentMode: settings.consentModeEnabled !== false,
  };
}
