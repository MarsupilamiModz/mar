import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { listPublicCollections } from "@/lib/collections-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Locale } from "@/i18n/config";
import { REVALIDATE } from "@/lib/cache";

export const revalidate = REVALIDATE.collections;

export default async function CollectionsPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;

  setRequestLocale(locale);
  const { items } = await listPublicCollections(1, 24);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Collections & Modpacks</h1>
        <p className="text-muted-foreground mt-2">
          Curated mod lists from creators and the community.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((c) => (
          <Link key={c.id} href={`/${locale}/collections/${c.slug}`}>
            <Card className="glass h-full hover:border-neon-purple/40 transition-colors">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg">{c.title}</CardTitle>
                  {c.isFeatured && <Badge>Featured</Badge>}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {c.description ?? "No description"}
                </p>
                <p className="text-xs text-muted-foreground mt-3">
                  {c._count.items} mods · {c._count.followers} followers ·{" "}
                  {c.downloadCount} downloads
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
