import Link from "next/link";
import { Gamepad2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SafeImage } from "@/components/ui/safe-image";

type GameCardProps = {
  locale: string;
  game: {
    slug: string;
    name: string;
    description?: string | null;
    iconUrl?: string | null;
    bannerUrl?: string | null;
    isFeatured?: boolean;
    _count?: { mods: number };
  };
  variant?: "default" | "hero";
};

export function GameCard({ locale, game, variant = "default" }: GameCardProps) {
  const modCount = game._count?.mods;

  if (variant === "hero" && game.bannerUrl) {
    return (
      <Link href={`/${locale}/games/${game.slug}`}>
        <Card className="group relative overflow-hidden aspect-[21/9] glass border-border/50 hover:border-neon-purple/50 hover:shadow-neon transition">
          <SafeImage
            src={game.bannerUrl}
            alt={game.name}
            fill
            className="object-cover opacity-60 group-hover:opacity-80 transition"
            sizes="100vw"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          <div className="absolute bottom-0 left-0 p-6">
            {game.isFeatured && <Badge variant="premium" className="mb-2">Featured</Badge>}
            <h3 className="text-2xl font-bold">{game.name}</h3>
            {game.description && (
              <p className="mt-1 text-sm text-muted-foreground line-clamp-2 max-w-xl">{game.description}</p>
            )}
            {modCount !== undefined && (
              <p className="mt-2 text-xs text-neon-blue">{modCount} mods</p>
            )}
          </div>
        </Card>
      </Link>
    );
  }

  return (
    <Link href={`/${locale}/games/${game.slug}`}>
      <Card className="glass p-6 h-full transition hover:border-neon-purple/40 hover:shadow-neon group">
        <div className="flex items-start gap-4">
          {game.iconUrl ? (
            <div className="relative h-14 w-14 shrink-0 rounded-xl overflow-hidden border border-border/50">
              <SafeImage src={game.iconUrl} alt="" fill className="object-cover" sizes="56px" />
            </div>
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-neon-purple/30 to-neon-blue/20 border border-neon-purple/20">
              <Gamepad2 className="h-7 w-7 text-neon-blue" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold truncate">{game.name}</h3>
              {game.isFeatured && <Badge variant="premium" className="text-[10px]">Featured</Badge>}
            </div>
            {game.description && (
              <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{game.description}</p>
            )}
            {modCount !== undefined && (
              <p className="mt-3 text-xs text-neon-purple">{modCount} mods available</p>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}
