import Link from "next/link";
import { Plus } from "lucide-react";
import { getAdminGames } from "@/actions/admin/games";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { Locale } from "@/i18n/config";

export default async function AdminGamesPage({ params: { locale } }: { params: { locale: Locale } }) {
  const result = await getAdminGames();
  const games = result.success ? result.data : [];

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Game Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Create and manage supported games</p>
        </div>
        <Button variant="neon" asChild>
          <Link href={`/${locale}/admin/games/new`}>
            <Plus className="h-4 w-4 mr-2" /> Add Game
          </Link>
        </Button>
      </div>

      <div className="mt-8 space-y-3">
        {games.length === 0 ? (
          <Card className="glass p-12 text-center text-muted-foreground">
            No games yet. Run <code className="text-neon-purple">npm run db:seed</code> or add a game.
          </Card>
        ) : (
          games.map((g) => (
            <Card key={g.id} className="glass p-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{g.name}</p>
                  {!g.isActive && <Badge variant="destructive">Inactive</Badge>}
                  {g.isFeatured && <Badge variant="premium">Featured</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">/{g.slug} · {g._count.mods} mods · {g._count.categories} categories</p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/${locale}/admin/games/${g.id}`}>Edit</Link>
              </Button>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
