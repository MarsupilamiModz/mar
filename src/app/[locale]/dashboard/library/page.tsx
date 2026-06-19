import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { getUserLibrary } from "@/actions/shop";
import { ModCard } from "@/components/mods/mod-card";
import { Card } from "@/components/ui/card";
import { formatCreditsFromCents } from "@/lib/credits";
import { mapModMedia } from "@/lib/mod-media";
import { formatDateTime } from "@/lib/format-locale";
import type { Locale } from "@/i18n/config";

export default async function LibraryPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;

  const user = await requireAuth(`/${locale}/login`);
  const { modPurchases, shopPurchases } = await getUserLibrary(user.id);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">My Library</h1>
        <p className="text-muted-foreground">Owned mods and purchased products</p>
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-4">Owned mods ({modPurchases.length})</h2>
        {modPurchases.length === 0 ? (
          <Card className="glass p-8 text-center text-muted-foreground">
            No purchased mods yet.{" "}
            <Link href={`/${locale}/shop`} className="text-neon-purple hover:underline">
              Visit the shop
            </Link>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {modPurchases.map((p) =>
              p.mod ? (
                <ModCard
                  key={p.id}
                  locale={locale}
                  mod={{
                    id: p.mod.id,
                    slug: p.mod.slug,
                    title: p.mod.title,
                    pricing: p.mod.pricing,
                    downloadCount: p.mod.downloadCount,
                    averageRating: 0,
                    game: p.mod.game,
                    media: mapModMedia(p.mod.media ?? []),
                    screenshots: p.mod.screenshots,
                  }}
                  showLike={false}
                />
              ) : null
            )}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-4">Shop purchases ({shopPurchases.length})</h2>
        {shopPurchases.length === 0 ? (
          <Card className="glass p-8 text-center text-muted-foreground">No shop purchases yet.</Card>
        ) : (
          <div className="space-y-2">
            {shopPurchases.map((p) => (
              <Card key={p.id} className="glass p-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{p.product.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(p.createdAt, locale)} · {p.product.productType}
                  </p>
                </div>
                <p className="text-sm text-neon-purple">
                  {p.creditsSpent > 0
                    ? formatCreditsFromCents(p.creditsSpent, locale)
                    : formatCreditsFromCents(p.priceCents, locale)}
                </p>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
