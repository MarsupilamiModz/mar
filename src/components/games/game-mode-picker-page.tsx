import { SafeImage } from "@/components/ui/safe-image";
import { GameModeSelectionCard } from "@/components/games/game-mode-selection-card";
import type { GameModeCardData } from "@/lib/game-modes";

type Props = {
  locale: string;
  game: {
    slug: string;
    name: string;
    description?: string | null;
    bannerUrl?: string | null;
    coverUrl?: string | null;
  };
  modes: GameModeCardData[];
  labels: {
    choosePlatform: string;
    modesAvailable: string;
  };
};

export function GameModePickerPage({ locale, game, modes, labels }: Props) {
  const hero = game.bannerUrl ?? game.coverUrl;

  return (
    <div className="min-h-[70vh]">
      <div className="relative overflow-hidden border-b border-border/40">
        {hero && (
          <div className="absolute inset-0">
            <SafeImage src={hero} alt="" fill className="object-cover opacity-30" sizes="100vw" priority />
            <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/80 to-background" />
          </div>
        )}
        <div className="relative mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-20">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl text-gradient">{game.name}</h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">{labels.choosePlatform}</p>
          {game.description && (
            <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground/80">{game.description}</p>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <div className="grid gap-5 sm:grid-cols-2">
          {modes.map((mode) => (
            <GameModeSelectionCard
              key={mode.id}
              locale={locale}
              gameSlug={game.slug}
              mode={mode}
            />
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-muted-foreground">
          {labels.modesAvailable}
        </p>
      </div>
    </div>
  );
}
