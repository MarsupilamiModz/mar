"use client";

import { memo, useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Loader2, Search, X } from "lucide-react";
import {
  globalSearchAction,
  type GlobalSearchGroups,
  type GlobalSearchItem,
} from "@/actions/global-search";
import { Input } from "@/components/ui/input";
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

function ResultRow({
  item,
  onSelect,
}: {
  item: GlobalSearchItem;
  onSelect: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onSelect}
      className="block rounded-lg px-3 py-2 text-sm transition-colors hover:bg-white/5"
    >
      <p className="truncate font-medium">{item.title}</p>
      {item.subtitle && (
        <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>
      )}
    </Link>
  );
}

export const HeaderSearch = memo(function HeaderSearch({ locale }: { locale: string }) {
  const t = useTranslations("search");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<GlobalSearchGroups>(EMPTY);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setGroups(EMPTY);
  }, []);

  useEffect(() => {
    if (open) {
      const id = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open, close]);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (!open || query.trim().length < 2) {
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
  }, [query, locale, open]);

  const hasResults = GROUP_ORDER.some((k) => groups[k].length > 0);

  if (!open) {
    return (
      <button
        type="button"
        aria-label={t("title")}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
        onClick={() => setOpen(true)}
      >
        <Search className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div ref={containerRef} className="relative flex items-center">
      <div className="flex w-[min(420px,70vw)] items-center gap-2 rounded-lg border border-border/50 bg-background/90 px-2 py-1">
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("placeholder")}
          className="h-8 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0"
        />
        {pending && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
        <button
          type="button"
          aria-label={t("close")}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-white/5"
          onClick={close}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {(query.trim().length >= 2 || hasResults) && (
        <div
          className={cn(
            "absolute right-0 top-full z-50 mt-2 w-[min(420px,90vw)] overflow-hidden rounded-xl border border-border/50 bg-card shadow-xl"
          )}
        >
          <div className="max-h-[min(60vh,400px)] overflow-y-auto p-2">
            {query.trim().length < 2 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t("hint")}</p>
            ) : !pending && !hasResults ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t("noResults")}</p>
            ) : (
              GROUP_ORDER.map((key) => {
                const items = groups[key];
                if (!items.length) return null;
                return (
                  <div key={key} className="mb-2">
                    <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t(`groups.${key}`)}
                    </p>
                    {items.slice(0, 5).map((item) => (
                      <ResultRow key={`${key}-${item.id}`} item={item} onSelect={close} />
                    ))}
                  </div>
                );
              })
            )}
          </div>
          {query.trim().length >= 2 && (
            <div className="border-t border-border/40 px-3 py-2 text-right">
              <Link
                href={`/${locale}/search?q=${encodeURIComponent(query)}`}
                onClick={close}
                className="text-xs text-neon-purple hover:underline"
              >
                {t("viewAll")}
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
