"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ModCard } from "@/components/mods/mod-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import type { ModListingItem } from "@/lib/data";

type Props = {
  locale: string;
  gameSlug: string;
  initialMods: ModListingItem[];
  initialTotal: number;
  pageSize: number;
  labels: {
    search: string;
    filter: string;
    allTypes: string;
    free: string;
    premium: string;
    paid: string;
    verified: string;
    sortDownloads: string;
    sortLikes: string;
    sortDate: string;
    results: string;
    noFilterResults: string;
    noModsYet: string;
    loadMore: string;
  };
  pricingLabels: Record<string, string>;
};

function useDebouncedCallback<T extends (...args: never[]) => void>(fn: T, ms: number) {
  const timer = useRef<ReturnType<typeof setTimeout>>();
  return useCallback(
    (...args: Parameters<T>) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => fn(...args), ms);
    },
    [fn, ms]
  );
}

export const GameModsExplorer = memo(function GameModsExplorer({
  locale,
  gameSlug,
  initialMods,
  initialTotal,
  pageSize,
  labels,
  pricingLabels,
}: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [mods, setMods] = useState(initialMods);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const filterKey = params.toString();

  useEffect(() => {
    setMods(initialMods);
    setTotal(initialTotal);
    setPage(1);
  }, [filterKey, initialMods, initialTotal]);

  const pushParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      next.delete("page");
      const qs = next.toString();
      startTransition(() => {
        router.replace(`/${locale}/games/${gameSlug}${qs ? `?${qs}` : ""}`, { scroll: false });
      });
    },
    [gameSlug, locale, params, router]
  );

  const debouncedSearch = useDebouncedCallback((value: string) => {
    pushParams({ q: value || null });
  }, 350);

  const hasMore = mods.length < total;

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const qs = new URLSearchParams(params.toString());
      qs.set("page", String(nextPage));
      qs.set("limit", String(pageSize));
      const res = await fetch(`/api/games/${gameSlug}/mods?${qs.toString()}`);
      if (!res.ok) return;
      const data = (await res.json()) as { mods: ModListingItem[]; total: number };
      setMods((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        const extra = data.mods.filter((m) => !seen.has(m.id));
        return [...prev, ...extra];
      });
      setTotal(data.total);
      setPage(nextPage);
    } finally {
      setLoadingMore(false);
    }
  }, [gameSlug, hasMore, loadingMore, page, pageSize, params]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  const sort = params.get("sort") ?? "downloads";

  const filterFields = useMemo(
    () => (
      <div className="flex flex-wrap gap-3">
        <Input
          key={`q-${filterKey}`}
          defaultValue={params.get("q") ?? ""}
          placeholder={labels.search}
          className="h-10 max-w-md flex-1 min-w-[180px]"
          onChange={(e) => debouncedSearch(e.target.value)}
        />
        <select
          defaultValue={params.get("pricing") ?? ""}
          className="h-10 rounded-md border border-input bg-background/50 px-3 text-sm"
          onChange={(e) => pushParams({ pricing: e.target.value || null })}
        >
          <option value="">{labels.allTypes}</option>
          <option value="FREE">{labels.free}</option>
          <option value="PREMIUM">{labels.premium}</option>
          <option value="PAID">{labels.paid}</option>
        </select>
        <select
          defaultValue={sort}
          className="h-10 rounded-md border border-input bg-background/50 px-3 text-sm"
          onChange={(e) => pushParams({ sort: e.target.value })}
        >
          <option value="downloads">{labels.sortDownloads}</option>
          <option value="likes">{labels.sortLikes}</option>
          <option value="date">{labels.sortDate}</option>
        </select>
        <label className="flex h-10 items-center gap-2 rounded-md border border-input bg-background/50 px-3 text-sm cursor-pointer">
          <input
            type="checkbox"
            defaultChecked={params.get("verified") === "1"}
            onChange={(e) => pushParams({ verified: e.target.checked ? "1" : null })}
          />
          {labels.verified}
        </label>
        {pending && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground self-center" />}
      </div>
    ),
    [debouncedSearch, filterKey, labels, params, pending, pushParams, sort]
  );

  return (
    <div className="space-y-8">
      {filterFields}

      <section>
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold">{labels.results}</h2>
          <span className="text-sm text-muted-foreground">{total}</span>
        </div>
        {mods.length === 0 ? (
          <p className="py-12 text-center text-muted-foreground">
            {filterKey ? labels.noFilterResults : labels.noModsYet}
          </p>
        ) : (
          <>
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {mods.map((mod) => (
                <ModCard
                  key={mod.id}
                  locale={locale}
                  mod={mod}
                  pricingLabel={pricingLabels[mod.pricing] ?? mod.pricing}
                />
              ))}
            </div>
            {hasMore && (
              <div ref={sentinelRef} className="mt-8 flex justify-center">
                <Button variant="outline" disabled={loadingMore} onClick={() => void loadMore()}>
                  {loadingMore ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {labels.loadMore}
                </Button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
});
