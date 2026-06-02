import Link from "next/link";
import { Plus } from "lucide-react";
import { getAdminGames } from "@/actions/admin/games";
import { AdminGamesList } from "@/components/admin/admin-games-list";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Locale } from "@/i18n/config";

export default async function AdminGamesPage({ params: { locale } }: { params: { locale: Locale } }) {
  const result = await getAdminGames();
  const games = result.success ? result.data : [];

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

      {games.length === 0 ? (
        <Card className="glass p-12 text-center text-muted-foreground mt-8">
          No games yet. Run <code className="text-neon-purple">npm run db:seed</code> or add a game.
        </Card>
      ) : (
        <AdminGamesList locale={locale} games={games} />
      )}
    </div>
  );
}
