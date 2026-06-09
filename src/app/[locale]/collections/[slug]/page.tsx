import { notFound } from "next/navigation";
import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { getCollectionBySlug, incrementCollectionView } from "@/lib/collections-data";
import { ModCard } from "@/components/mods/mod-card";
import { CollectionActions } from "@/components/collections/collection-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { Locale } from "@/i18n/config";

export const dynamic = "force-dynamic";

export default async function CollectionDetailPage({
  params: { locale, slug },
}: {
  params: { locale: Locale; slug: string };
}) {
  setRequestLocale(locale);
  const collection = await getCollectionBySlug(slug);
  if (!collection) notFound();
  if (collection.visibility === "PRIVATE") notFound();

  void incrementCollectionView(collection.id);

  const user = await getCurrentUser();
  const following = user
    ? await prisma.modCollectionFollow.findUnique({
        where: {
          collectionId_userId: { collectionId: collection.id, userId: user.id },
        },
      })
    : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
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
        <CollectionActions
          collectionId={collection.id}
          modIds={collection.items.map((i) => i.modId)}
          initialFollowing={!!following}
        />
      </div>

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
