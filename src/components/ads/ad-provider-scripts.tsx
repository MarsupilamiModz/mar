import { getAdSettings, getAdProviders, buildProviderScript } from "@/lib/ads";

export async function AdProviderScripts() {
  const [settings, providers] = await Promise.all([getAdSettings(), getAdProviders()]);

  if (!settings.globalAdsEnabled) return null;

  const scripts: string[] = [];
  for (const provider of providers) {
    if (!provider.isEnabled) continue;
    const config = {
      ...(provider.config as Record<string, string>),
      adsenseClientId: settings.adsenseClientId,
      nitropayId: settings.nitropayId,
      ezoicId: settings.ezoicId,
    };
    const built = provider.scriptHtml ?? buildProviderScript(provider.type, config);
    if (built) scripts.push(built);
  }

  if (scripts.length === 0) return null;

  return (
    <>
      {scripts.map((html, i) => (
        <script
          key={i}
          dangerouslySetInnerHTML={{ __html: html.replace(/<\/?script[^>]*>/gi, "") }}
        />
      ))}
    </>
  );
}
