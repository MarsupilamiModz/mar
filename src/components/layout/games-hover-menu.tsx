"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Gamepad2 } from "lucide-react";
import { SafeImage } from "@/components/ui/safe-image";
import { cn } from "@/lib/utils";
import type { NavGameItem } from "@/lib/nav-games";

type Props = {
  locale: string;
  label: string;
  games: NavGameItem[];
  allGamesLabel: string;
};

export const GamesHoverMenu = memo(function GamesHoverMenu({
  locale,
  label,
  games,
  allGamesLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  const cancelClose = useCallback(() => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const show = useCallback(() => {
    cancelClose();
    if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    rafRef.current = window.requestAnimationFrame(() => setOpen(true));
  }, [cancelClose]);

  const hide = useCallback(() => {
    cancelClose();
    closeTimerRef.current = window.setTimeout(() => setOpen(false), 80);
  }, [cancelClose]);

  useEffect(() => {
    return () => {
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  function resolveHref(game: NavGameItem) {
    if (game.soleModeSlug) {
      return `/${locale}/games/${game.slug}/${game.soleModeSlug}`;
    }
    return `/${locale}/games/${game.slug}`;
  }

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={(e) => {
        if (!rootRef.current?.contains(e.relatedTarget as Node)) hide();
      }}
    >
      <Link
        href={`/${locale}/games`}
        prefetch
        className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
        aria-haspopup="true"
        aria-expanded={open}
      >
        {label}
      </Link>

      <div
        className={cn(
          "games-hover-panel pointer-events-none absolute left-0 top-full z-50 pt-2",
          "opacity-0 scale-[0.98] -translate-y-1",
          open && "pointer-events-auto opacity-100 scale-100 translate-y-0"
        )}
        aria-hidden={!open}
      >
        <div className="w-[min(92vw,720px)] overflow-hidden rounded-2xl border border-white/10 bg-background/90 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <p className="text-sm font-semibold">{label}</p>
            <Link
              href={`/${locale}/games`}
              prefetch
              className="text-xs text-neon-purple hover:underline"
              onClick={() => setOpen(false)}
            >
              {allGamesLabel}
            </Link>
          </div>
          <div className="grid max-h-[min(70vh,420px)] grid-cols-2 gap-2 overflow-y-auto p-3 sm:grid-cols-3 md:grid-cols-4">
            {games.map((game) => (
              <Link
                key={game.id}
                href={resolveHref(game)}
                prefetch
                className="games-hover-item group flex flex-col overflow-hidden rounded-xl border border-border/40 bg-background/40"
                onClick={() => setOpen(false)}
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  {game.coverUrl ? (
                    <SafeImage
                      src={game.coverUrl}
                      alt={game.name}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      sizes="160px"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neon-purple/20 to-neon-blue/10">
                      <Gamepad2 className="h-8 w-8 text-muted-foreground/40" />
                    </div>
                  )}
                  {game.logoUrl && (
                    <div className="absolute bottom-1.5 left-1.5 h-7 w-7 overflow-hidden rounded-md border border-white/20 bg-background/80">
                      <SafeImage src={game.logoUrl} alt="" fill className="object-contain p-0.5" sizes="28px" />
                    </div>
                  )}
                </div>
                <p className="truncate px-2 py-2 text-xs font-medium group-hover:text-neon-purple">
                  {game.name}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});
