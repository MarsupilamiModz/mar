import Link from "next/link";
import { Plus } from "lucide-react";
import { requirePagePermission } from "@/lib/auth";
import { getAdminGames } from "@/actions/admin/games";
import { AdminGamesList } from "@/components/admin/admin-games-list";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Locale } from "@/i18n/config";

export default async function AdminGamesPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;

  await requirePagePermission("games.write");
  const result = await getAdminGames();
  const games = result.success ? result.data : [];
  const loadError = result.success ? null : result.error;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Supported Games</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage homepage visibility, order, featured games, and categories
          </p>
        </div>
        <Button variant="neon" asChild>
          <Link href={`/${locale}/admin/games/new`}>
            <Plus className="h-4 w-4 mr-2" /> Add Game
          </Link>
        </Button>
      </div>

      {loadError && (
        <div className="mt-6 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {loadError}
        </div>
      )}

      {!loadError && games.length === 0 ? (
        <Card className="glass p-12 text-center text-muted-foreground mt-8">
          No games yet. Run <code className="text-neon-purple">npm run db:seed</code> or add a game.
        </Card>
      ) : !loadError ? (
        <AdminGamesList locale={locale} games={games} />
      ) : null}
    </div>
  );
}
