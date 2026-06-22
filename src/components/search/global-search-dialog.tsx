"use client";

import { memo, useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Gamepad2, Loader2, Search, X } from "lucide-react";
import {
  globalSearchAction,
  type GlobalSearchGroups,
  type GlobalSearchItem,
} from "@/actions/global-search";
import { useGlobalSearch } from "@/components/search/global-search-provider";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SafeImage } from "@/components/ui/safe-image";
import { cn } from "@/lib/utils";

const EMPTY: GlobalSearchGroups = {
  mods: [],
  sounds: [],
  collections: [],
  modpacks: [],
  creators: [],
  partners: [],
  games: [],
  categories: [],
};

type GroupKey = keyof GlobalSearchGroups;

const GROUP_ORDER: GroupKey[] = [
  "mods",
  "sounds",
  "collections",
  "modpacks",
  "creators",
  "partners",
  "games",
  "categories",
];

function ResultRow({ item, onSelect }: { item: GlobalSearchItem; onSelect: () => void }) {
  return (
    <Link
      href={item.href}
      onClick={onSelect}
      className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-white/5"
    >
      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted/30">
        {item.thumbnailUrl ? (
          <SafeImage src={item.thumbnailUrl} alt="" fill className="object-cover" sizes="40px" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Gamepad2 className="h-4 w-4 text-muted-foreground/50" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.title}</p>
        {item.subtitle && (
          <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>
        )}
      </div>
    </Link>
  );
}

export const GlobalSearchDialog = memo(function GlobalSearchDialog({ locale }: { locale: string }) {
  const t = useTranslations("search");
  const { open, setOpen } = useGlobalSearch();
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<GlobalSearchGroups>(EMPTY);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setGroups(EMPTY);
  }, [setOpen]);

  useEffect(() => {
    if (open) {
      const tId = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(tId);
    }
  }, [open]);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setGroups(EMPTY);
      return;
    }
    debounceRef.current = window.setTimeout(() => {
      startTransition(async () => {
        const result = await globalSearchAction(query, locale);
        if (result.success) setGroups(result.data);
      });
    }, 300);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query, locale]);

  const hasResults = GROUP_ORDER.some((k) => groups[k].length > 0);
  const groupLabels: Record<GroupKey, string> = {
    mods: t("groups.mods"),
    sounds: t("groups.sounds"),
    collections: t("groups.collections"),
    modpacks: t("groups.modpacks"),
    creators: t("groups.creators"),
    partners: t("groups.partners"),
    games: t("groups.games"),
    categories: t("groups.categories"),
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : close())}>
      <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0 sm:rounded-2xl">
        <DialogTitle className="sr-only">{t("title")}</DialogTitle>
        <div className="flex items-center gap-2 border-b border-border/50 px-4 py-3">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("placeholder")}
            className="border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
          {pending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <kbd className="hidden rounded border border-border/60 px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline">
            ESC
          </kbd>
          <button type="button" onClick={close} className="rounded-md p-1 hover:bg-white/5" aria-label={t("close")}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[min(70vh,520px)] overflow-y-auto p-2">
          {query.trim().length < 2 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">{t("hint")}</p>
          ) : !pending && !hasResults ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">{t("noResults")}</p>
          ) : (
            GROUP_ORDER.map((key) => {
              const items = groups[key];
              if (!items.length) return null;
              return (
                <div key={key} className="mb-3">
                  <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {groupLabels[key]}
                  </p>
                  <div className={cn("space-y-0.5")}>
                    {items.map((item) => (
                      <ResultRow key={`${key}-${item.id}`} item={item} onSelect={close} />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border/50 px-4 py-2 text-[11px] text-muted-foreground">
          <span>{t("shortcutHint")}</span>
          <Link href={`/${locale}/search?q=${encodeURIComponent(query)}`} onClick={close} className="hover:text-neon-purple">
            {t("viewAll")}
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
});
