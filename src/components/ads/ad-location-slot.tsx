import { getCurrentUser } from "@/lib/auth";
import { getAdsForLocation, getAdSettings, type AdLocation } from "@/lib/ads";
import { getUserAdExperience, shouldRenderAds, adDensityClass } from "@/lib/ad-experience";
import { AdSlot } from "@/components/ads/ad-slot";

type AdLocationSlotProps = {
  location: AdLocation;
  className?: string;
};

export async function AdLocationSlot({ location, className }: AdLocationSlotProps) {
  const settings = await getAdSettings();
  if (!settings.globalAdsEnabled) return null;
  if (settings.placementEnabled?.[location] === false) return null;

  const user = await getCurrentUser();
  const level = await getUserAdExperience(user?.id ?? null, user?.role ?? null);
  if (!shouldRenderAds(level)) return null;

  const ads = await getAdsForLocation(location);
  if (ads.length === 0) return null;

  const density = adDensityClass(level);
  const visibleAds = level === "reduced" ? ads.slice(0, 1) : ads;

  return (
    <div className={`${className ?? ""} ${density}`.trim()}>
      {visibleAds.map((ad) => (
        <AdSlot key={ad.id} ad={ad} className="mb-4" />
      ))}
    </div>
  );
}
