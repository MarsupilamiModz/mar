import { unstable_cache } from "next/cache";
import { revalidateTag } from "next/cache";
import { loadPublicBrandingBundle, type PublicBrandingBundle } from "@/lib/branding-cms";
import { REVALIDATE } from "@/lib/cache";

export const BRANDING_CACHE_TAG = "branding";

export function getCachedPublicBranding(): Promise<PublicBrandingBundle> {
  return unstable_cache(
    () => loadPublicBrandingBundle(),
    ["public-branding-bundle"],
    {
      revalidate: REVALIDATE.branding,
      tags: [BRANDING_CACHE_TAG],
    }
  )();
}

export function invalidateBrandingCache() {
  revalidateTag(BRANDING_CACHE_TAG);
}
