import { getCurrentUser } from "@/lib/auth";
import { getAdsForLocation, getAdSettings, type AdLocation } from "@/lib/ads";
import { userHasAdFree } from "@/lib/membership";
import { AdSlot } from "@/components/ads/ad-slot";

type AdLocationSlotProps = {
  location: AdLocation;
  className?: string;
};

export async function AdLocationSlot({ location, className }: AdLocationSlotProps) {
  const settings = await getAdSettings();
  if (!settings.globalAdsEnabled) return null;

  const user = await getCurrentUser();
  if (user) {
    const adFree = await userHasAdFree(user.id, user.role);
    if (adFree) return null;
  }

  const ads = await getAdsForLocation(location);
  if (ads.length === 0) return null;

  return (
    <div className={className}>
      {ads.map((ad) => (
        <AdSlot key={ad.id} ad={ad} className="mb-4" />
      ))}
    </div>
  );
}
