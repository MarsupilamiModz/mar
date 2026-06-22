"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  GameModeSelectionCard,
  GameModeSelectionCardSkeleton,
} from "@/components/games/game-mode-selection-card";
import type { GameModeCardData } from "@/lib/game-modes";

type Props = {
  locale: string;
  gameSlug: string;
  gameName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modes?: GameModeCardData[];
};

export const GameModePickerModal = memo(function GameModePickerModal({
  locale,
  gameSlug,
  gameName,
  open,
  onOpenChange,
  modes: initialModes,
}: Props) {
  const t = useTranslations("games");
  const router = useRouter();
  const [modes, setModes] = useState<GameModeCardData[]>(initialModes ?? []);
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(false);

  const loadModes = useCallback(async () => {
    if (initialModes?.length) {
      setModes(initialModes);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/games/${gameSlug}/modes`);
      if (res.ok) {
        const data = (await res.json()) as { modes: GameModeCardData[] };
        setModes(data.modes);
        if (data.modes.length === 1) {
          onOpenChange(false);
          router.push(`/${locale}/games/${gameSlug}/${data.modes[0]!.slug}`);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [gameSlug, initialModes, locale, onOpenChange, router]);

  useEffect(() => {
    if (!open) {
      fetchedRef.current = false;
      return;
    }
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    void loadModes();
  }, [open, loadModes]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass max-h-[90vh] max-w-2xl overflow-y-auto border-neon-purple/25 bg-background/80 p-0 shadow-[0_0_48px_rgba(168,85,247,0.15)] backdrop-blur-xl sm:rounded-2xl">
        <div className="border-b border-border/40 bg-gradient-to-br from-neon-purple/10 via-transparent to-neon-blue/5 p-6 sm:p-8">
          <DialogHeader className="text-left space-y-2">
            <DialogTitle className="text-2xl font-bold tracking-tight">{gameName}</DialogTitle>
            <DialogDescription className="text-base text-muted-foreground">
              {t("choosePlatform")}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="grid gap-4 p-6 sm:grid-cols-2 sm:p-8">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <GameModeSelectionCardSkeleton key={i} />)
            : modes.map((mode) => (
                <GameModeSelectionCard
                  key={mode.id}
                  locale={locale}
                  gameSlug={gameSlug}
                  mode={mode}
                  onSelect={() => onOpenChange(false)}
                />
              ))}
        </div>

        {!loading && modes.length > 0 && (
          <p className="border-t border-border/40 px-6 pb-6 text-center text-sm text-muted-foreground sm:px-8">
            {t("modesAvailable", { count: modes.length })}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
});
