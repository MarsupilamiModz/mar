import { resolveHostingPartner } from "@/lib/hosting/resolve";
import { HostingServerCta } from "@/components/hosting/hosting-server-cta";
import { HostingBannerWidget } from "@/components/hosting/hosting-banner";

type ModHostingProps = {
  mod: {
    id: string;
    gameId: string;
    authorId: string;
    serverPartnerEnabled: boolean;
    serverPartnerId: string | null;
    serverPartnerLink: string | null;
    serverPartnerBanner: string | null;
  };
  variant?: "inline" | "sidebar";
  showBanner?: boolean;
};

export async function ModHostingSection({
  mod,
  variant = "inline",
  showBanner = true,
}: ModHostingProps) {
  const partner = await resolveHostingPartner({ mod, gameId: mod.gameId });
  if (!partner) return null;

  return (
    <div className="space-y-4">
      <HostingServerCta
        partner={partner}
        modId={mod.id}
        gameId={mod.gameId}
        variant={variant}
      />
      {showBanner ? (
        <HostingBannerWidget
          partner={partner}
          modId={mod.id}
          gameId={mod.gameId}
          size={variant === "sidebar" ? "300x250" : "728x90"}
        />
      ) : null}
    </div>
  );
}

type CollectionHostingProps = {
  collection: {
    id: string;
    ownerId: string;
    creatorId: string | null;
    serverPartnerEnabled: boolean;
    serverPartnerId: string | null;
    serverPartnerLink: string | null;
    serverPartnerBanner: string | null;
  };
  gameId?: string | null;
  variant?: "inline" | "sidebar";
  showBanner?: boolean;
};

export async function CollectionHostingSection({
  collection,
  gameId,
  variant = "inline",
  showBanner = true,
}: CollectionHostingProps) {
  const partner = await resolveHostingPartner({ collection, gameId });
  if (!partner) return null;

  return (
    <div className="space-y-4">
      <HostingServerCta
        partner={partner}
        collectionId={collection.id}
        gameId={gameId ?? undefined}
        variant={variant}
      />
      {showBanner ? (
        <HostingBannerWidget
          partner={partner}
          collectionId={collection.id}
          gameId={gameId ?? undefined}
          size={variant === "sidebar" ? "300x250" : "970x250"}
        />
      ) : null}
    </div>
  );
}
