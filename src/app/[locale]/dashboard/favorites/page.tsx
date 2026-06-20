import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { getUserFavorites } from "@/actions/favorites";
import { ModCard } from "@/components/mods/mod-card";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";

export default async function FavoritesPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;

  await requireAuth(`/${locale}/dashboard/favorites`);
  const result = await getUserFavorites();
  const favorites = result.success ? result.data : [];

  return (
    <div>
      <h1 className="text-2xl font-bold">Favorites</h1>
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {favorites.length === 0 ? (
          <Card className="glass col-span-full p-12 text-center">
            <p className="text-muted-foreground">No favorites yet.</p>
            <Button variant="neon" className="mt-4" asChild>
              <Link href={`/${locale}/mods`}>Browse mods</Link>
            </Button>
          </Card>
        ) : (
          favorites.map((f) => (
            <ModCard key={f.id} locale={locale} mod={f.mod} />
          ))
        )}
      </div>
    </div>
  );
}
