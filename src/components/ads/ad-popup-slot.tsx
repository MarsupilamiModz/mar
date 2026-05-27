import { getCurrentUser } from "@/lib/auth";
import { getAdSettings, getPopupAds } from "@/lib/ads";
import { userHasAdFree } from "@/lib/membership";
import { AdPopup } from "@/components/ads/ad-popup";

export async function AdPopupSlot() {
  const settings = await getAdSettings();
  if (!settings.globalAdsEnabled || !settings.popupAdsEnabled) return null;

  const user = await getCurrentUser();
  if (user) {
    const adFree = await userHasAdFree(user.id, user.role);
    if (adFree || ["PREMIUM", "OWNER", "ADMIN", "MODERATOR"].includes(user.role)) return null;
  }

  const ads = await getPopupAds();
  if (ads.length === 0) return null;

  return <AdPopup ad={ads[0]} />;
}
