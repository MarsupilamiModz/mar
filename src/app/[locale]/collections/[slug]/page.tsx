import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { setRequestLocale } from "next-intl/server";
import { getCollectionBySlug, incrementCollectionView } from "@/lib/collections-data";
import { ModCard } from "@/components/mods/mod-card";
import { CollectionActions } from "@/components/collections/collection-actions";
import { CollectionHostingSection } from "@/components/hosting/hosting-section";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import type { Locale } from "@/i18n/config";

export const dynamic = "force-dynamic";

export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}) {
  const { locale, slug } = await params;

  setRequestLocale(locale);
  const collection = await getCollectionBySlug(slug);
  if (!collection) notFound();

  const user = await getCurrentUser();
  if (
    collection.visibility === "PRIVATE" &&
    (!user || (collection.ownerId !== user.id && !isAdmin(user.role)))
  ) {
    notFound();
  }

  void incrementCollectionView(collection.id);
  const following = user
    ? await prisma.modCollectionFollow.findUnique({
        where: {
          collectionId_userId: { collectionId: collection.id, userId: user.id },
        },
      })
    : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      {collection.bannerUrl && (
        <div className="relative mb-8 h-48 w-full overflow-hidden rounded-xl border border-border/40 sm:h-64">
          <Image
            src={collection.bannerUrl}
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
            priority
          />
        </div>
      )}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="flex gap-4">
          {collection.coverUrl && (
            <Image
              src={collection.coverUrl}
              alt=""
              width={96}
              height={96}
              className="h-24 w-24 shrink-0 rounded-lg border border-border/40 object-cover"
            />
          )}
          <div>
          <div className="flex items-center gap-2 mb-2">
            {collection.isFeatured && <Badge>Featured</Badge>}
            <Badge variant="outline">{collection.visibility}</Badge>
          </div>
          <h1 className="text-3xl font-bold">{collection.title}</h1>
          {collection.description && (
            <p className="text-muted-foreground mt-2 max-w-2xl">{collection.description}</p>
          )}
          <p className="text-sm text-muted-foreground mt-3">
            by{" "}
            <Link href={`/${locale}/creators/${collection.creator?.slug ?? collection.owner.username}`} className="text-neon-purple hover:underline">
              {collection.creator?.user.displayName ?? collection.creator?.user.username ?? collection.owner.displayName ?? collection.owner.username}
            </Link>
            {" · "}
            {collection.viewCount} views · {collection.followerCount} followers ·{" "}
            {collection.downloadCount} installs
          </p>
          </div>
        </div>
        <CollectionActions
          collectionId={collection.id}
          modIds={collection.items.map((i) => i.modId)}
          initialFollowing={!!following}
        />
      </div>

      <CollectionHostingSection
        collection={{
          id: collection.id,
          ownerId: collection.ownerId,
          creatorId: collection.creatorId,
          serverPartnerEnabled: collection.serverPartnerEnabled,
          serverPartnerId: collection.serverPartnerId,
          serverPartnerLink: collection.serverPartnerLink,
          serverPartnerBanner: collection.serverPartnerBanner,
        }}
        gameId={collection.items[0]?.mod.game?.id ?? null}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {collection.items.map(({ mod, note }) => (
          <div key={mod.id} className="space-y-2">
            <ModCard locale={locale} mod={mod} />
            {note && (
              <Card className="glass">
                <CardContent className="py-2 text-xs text-muted-foreground">{note}</CardContent>
              </Card>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
