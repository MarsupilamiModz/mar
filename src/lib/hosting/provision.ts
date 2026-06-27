import type { ResolvedHostingPartner } from "@/lib/hosting/resolve";

export type ProvisionRequest = {
  partner: ResolvedHostingPartner;
  modId?: string;
  collectionId?: string;
  gameId?: string;
  gameSlug?: string;
  modpackTitle?: string;
};

export type ProvisionResult =
  | { ok: true; redirectUrl: string; provisioned: boolean }
  | { ok: false; error: string; fallbackUrl: string };

/** Provider-specific one-click install — falls back to affiliate URL when API unavailable. */
export async function provisionHostingServer(
  request: ProvisionRequest
): Promise<ProvisionResult> {
  const fallbackUrl = request.partner.affiliateUrl;

  if (!request.partner.oneClickEnabled || !request.partner.apiProvider) {
    return { ok: true, redirectUrl: fallbackUrl, provisioned: false };
  }

  const provider = request.partner.apiProvider.toUpperCase();

  try {
    switch (provider) {
      case "NITRADO":
      case "ZAP":
      case "GPORTAL":
      case "SHOCKBYTE":
      case "BISECT":
        // API credentials live in HostingPartner.apiConfig — wire per provider when keys are configured.
        return {
          ok: true,
          redirectUrl: appendProvisionParams(fallbackUrl, request),
          provisioned: false,
        };
      default:
        return { ok: true, redirectUrl: fallbackUrl, provisioned: false };
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Provisioning failed",
      fallbackUrl,
    };
  }
}

function appendProvisionParams(url: string, request: ProvisionRequest) {
  try {
    const u = new URL(url);
    if (request.modId) u.searchParams.set("modpack_id", request.modId);
    if (request.collectionId) u.searchParams.set("collection_id", request.collectionId);
    if (request.gameId) u.searchParams.set("game_id", request.gameId);
    if (request.gameSlug) u.searchParams.set("game", request.gameSlug);
    if (request.modpackTitle) u.searchParams.set("modpack", request.modpackTitle);
    return u.toString();
  } catch {
    return url;
  }
}
