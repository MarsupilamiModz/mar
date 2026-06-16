"use client";

import { Fragment } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { ModCard } from "@/components/mods/mod-card";
import { formatNumber } from "@/lib/format-locale";
import { SOUND_CATEGORIES } from "@/lib/sound";

type Game = { id: string; slug: string; name: string };
type Mod = Parameters<typeof ModCard>[0]["mod"];

export function ModsCatalogClient({
  locale,
  initialMods,
  games,
  total,
  pages,
  initialQuery,
  initialGame,
  initialPricing,
  initialType,
  initialAudioCategory,
  initialGenre,
  initialPage,
  listingAdBreak,
}: {
  locale: string;
  initialMods: Mod[];
  games: Game[];
  total: number;
  pages: number;
  initialQuery?: string;
  initialGame?: string;
  initialPricing?: string;
  initialType?: string;
  initialAudioCategory?: string;
  initialGenre?: string;
  initialPage: number;
  listingAdBreak?: React.ReactNode;
}) {
  const t = useTranslations("mods");
  const ts = useTranslations("sounds");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(initialQuery ?? "");
  const [pending, startTransition] = useTransition();

  const pushFilters = useCallback(
    (next: {
      q?: string;
      game?: string;
      pricing?: string;
      type?: string;
      audioCategory?: string;
      genre?: string;
      page?: number;
    }) => {
      const params = new URLSearchParams(searchParams.toString());
      const setOrDelete = (key: string, val?: string) => {
        if (val === undefined) return;
        if (val) params.set(key, val);
        else params.delete(key);
      };
      setOrDelete("q", next.q);
      setOrDelete("game", next.game);
      setOrDelete("pricing", next.pricing);
      setOrDelete("type", next.type);
      setOrDelete("audioCategory", next.audioCategory);
      setOrDelete("genre", next.genre);
      if (next.page !== undefined) {
        if (next.page > 1) params.set("page", String(next.page));
        else params.delete("page");
      }
      startTransition(() => {
        router.push(`/${locale}/mods?${params.toString()}`);
      });
    },
    [locale, router, searchParams]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      if (q !== (initialQuery ?? "")) pushFilters({ q, page: 1 });
    }, 350);
    return () => clearTimeout(timer);
  }, [q, initialQuery, pushFilters]);

  const pricingLabels: Record<string, string> = {
    FREE: t("free"),
    PREMIUM: t("premium"),
    PAID: t("paid"),
  };

  const showAudioFilters = initialType === "SOUND" || !initialType;

  return (
    <>
      <p className="mt-2 text-muted-foreground">
        {formatNumber(total, locale)} {pending ? "…" : ""}
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("search")}
          className="max-w-md"
        />
        <select
          defaultValue={initialType ?? ""}
          onChange={(e) => pushFilters({ type: e.target.value, page: 1 })}
          className="h-10 rounded-md border border-input bg-background/50 px-3 text-sm"
        >
          <option value="">{ts("filterAllTypes")}</option>
          <option value="MOD">{ts("typeMod")}</option>
          <option value="SOUND">{ts("typeSound")}</option>
        </select>
        <select
          defaultValue={initialGame}
          onChange={(e) => pushFilters({ game: e.target.value, page: 1 })}
          className="h-10 rounded-md border border-input bg-background/50 px-3 text-sm"
        >
          <option value="">{t("filter")}</option>
          {games.map((g) => (
            <option key={g.id} value={g.slug}>
              {g.name}
            </option>
          ))}
        </select>
        <select
          defaultValue={initialPricing}
          onChange={(e) => pushFilters({ pricing: e.target.value, page: 1 })}
          className="h-10 rounded-md border border-input bg-background/50 px-3 text-sm"
        >
          <option value="">All</option>
          <option value="FREE">{t("free")}</option>
          <option value="PREMIUM">{t("premium")}</option>
          <option value="PAID">{t("paid")}</option>
        </select>
        {(initialType === "SOUND" || showAudioFilters) && (
          <>
            <select
              defaultValue={initialAudioCategory ?? ""}
              onChange={(e) => pushFilters({ audioCategory: e.target.value, type: "SOUND", page: 1 })}
              className="h-10 rounded-md border border-input bg-background/50 px-3 text-sm"
            >
              <option value="">{ts("allAudioCategories")}</option>
              {SOUND_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {ts(`categories.${c.labelKey}`)}
                </option>
              ))}
            </select>
            <Input
              defaultValue={initialGenre ?? ""}
              placeholder={ts("genre")}
              className="max-w-[140px]"
              onBlur={(e) => pushFilters({ genre: e.target.value, page: 1 })}
            />
          </>
        )}
      </div>

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {initialMods.map((mod, index) => (
          <Fragment key={mod.slug}>
            <ModCard
              locale={locale}
              mod={mod}
              pricingLabel={pricingLabels[mod.pricing] ?? mod.pricing}
            />
            {listingAdBreak && index === 3 && (
              <div className="col-span-full">{listingAdBreak}</div>
            )}
          </Fragment>
        ))}
      </div>

      {pages > 1 && (
        <div className="mt-8 flex justify-center gap-2">
          {Array.from({ length: Math.min(pages, 10) }, (_, i) => {
            const p = i + 1;
            return (
              <button
                key={p}
                type="button"
                onClick={() => pushFilters({ page: p })}
                className={`rounded px-3 py-1 text-sm border ${
                  p === initialPage ? "border-neon-purple bg-neon-purple/10" : "border-border hover:bg-accent/20"
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
