import { getCurrentUser } from "@/lib/auth";
import { getAdSettings, getPopupAds } from "@/lib/ads";
import { getUserAdExperience, shouldRenderAds } from "@/lib/ad-experience";
import { AdPopup } from "@/components/ads/ad-popup";

export async function AdPopupSlot() {
  const settings = await getAdSettings();
  if (!settings.globalAdsEnabled || !settings.popupAdsEnabled) return null;

  const user = await getCurrentUser();
  const level = await getUserAdExperience(user?.id ?? null, user?.role ?? null);
  if (!shouldRenderAds(level)) return null;
  if (level === "reduced") return null;

  const ads = await getPopupAds();
  if (ads.length === 0) return null;

  return <AdPopup ad={ads[0]} />;
}
