import type { MetadataRoute } from "next";
import { getCachedPublicBranding } from "@/lib/branding-data";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { branding } = await getCachedPublicBranding();
  const icon = branding.pwaIconUrl ?? branding.faviconUrl ?? "/icon.svg";

  return {
    name: branding.siteTitle,
    short_name: branding.siteShortName,
    description: branding.siteTagline,
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0f",
    theme_color: branding.primaryColor,
    icons: [
      {
        src: icon,
        sizes: "any",
        type: icon.endsWith(".svg") ? "image/svg+xml" : "image/png",
        purpose: "any",
      },
      {
        src: icon,
        sizes: "any",
        type: icon.endsWith(".svg") ? "image/svg+xml" : "image/png",
        purpose: "maskable",
      },
      ...(branding.androidIconUrl && branding.androidIconUrl !== icon
        ? [{ src: branding.androidIconUrl, sizes: "192x192", type: "image/png", purpose: "any" as const }]
        : []),
    ],
  };
}

export async function generateMetadata() {
  const { branding } = await getCachedPublicBranding();
  const icon = branding.faviconUrl ?? "/icon.svg";
  return {
    icons: {
      icon: [{ url: icon, type: icon.endsWith(".svg") ? "image/svg+xml" : "image/png" }],
      apple: [{ url: branding.appleTouchIconUrl ?? icon }],
    },
    themeColor: branding.primaryColor,
    applicationName: branding.siteShortName,
  };
}
