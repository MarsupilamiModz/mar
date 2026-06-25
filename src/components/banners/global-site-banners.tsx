import { getActiveSiteBanners } from "@/lib/site-banners";
import { SiteBannerRail } from "@/components/banners/site-banner-rail";

export async function GlobalSiteBanners() {
  const banners = await getActiveSiteBanners();
  const globalOnly = banners.filter((b) => b.type === "GLOBAL");
  if (!globalOnly.length) return null;
  return <SiteBannerRail banners={globalOnly} />;
}
