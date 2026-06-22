"use client";

import { memo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Layers } from "lucide-react";
import { SafeImage } from "@/components/ui/safe-image";
import { cn } from "@/lib/utils";
import type { CategoryDiscoveryNode } from "@/lib/game-discovery";

type Props = {
  locale: string;
  gameSlug: string;
  categories: CategoryDiscoveryNode[];
};

function buildHref(locale: string, gameSlug: string, params: URLSearchParams, patch: Record<string, string | null>) {
  const next = new URLSearchParams(params.toString());
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) next.delete(key);
    else next.set(key, value);
  }
  next.delete("page");
  const qs = next.toString();
  return `/${locale}/games/${gameSlug}${qs ? `?${qs}` : ""}`;
}

function CategoryRow({
  locale,
  gameSlug,
  category,
  params,
  depth,
  parentSlug,
}: {
  locale: string;
  gameSlug: string;
  category: CategoryDiscoveryNode;
  params: URLSearchParams;
  depth: number;
  parentSlug?: string;
}) {
  const t = useTranslations("games");
  const activeCategory = params.get("category");
  const activeSub = params.get("subcategory");
  const isRoot = depth === 0;
  const isActive = isRoot
    ? activeCategory === category.slug && !activeSub
    : activeSub === category.slug;

  const href = isRoot
    ? buildHref(locale, gameSlug, params, { category: category.slug, subcategory: null })
    : buildHref(locale, gameSlug, params, {
        category: parentSlug ?? activeCategory ?? category.slug,
        subcategory: category.slug,
      });

  const thumb = category.thumbnailUrl ?? category.iconUrl;

  return (
    <>
      <Link
        href={href}
        scroll={false}
        className={cn(
          "flex gap-3 rounded-xl border p-2.5 transition-all",
          isActive
            ? "border-neon-purple/60 bg-neon-purple/10 shadow-[0_0_16px_rgba(168,85,247,0.15)]"
            : "border-border/40 bg-background/30 hover:border-neon-purple/30 hover:bg-background/50"
        )}
        style={{ marginLeft: depth * 12, ...(category.accentColor && isActive ? { borderColor: category.accentColor } : {}) }}
      >
        <div
          className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border/50 bg-muted/30"
          style={category.accentColor ? { boxShadow: `0 0 12px ${category.accentColor}33` } : undefined}
        >
          {thumb ? (
            <SafeImage src={thumb} alt="" fill className="object-cover" sizes="56px" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Layers className="h-5 w-5 text-muted-foreground/50" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm leading-tight truncate">{category.name}</p>
          {category.description && (
            <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">{category.description}</p>
          )}
          <p className="mt-1 text-xs text-neon-blue">
            {t("modsCount", { count: category.modCount })}
          </p>
        </div>
      </Link>
      {category.children.map((child) => (
        <CategoryRow
          key={child.id}
          locale={locale}
          gameSlug={gameSlug}
          category={child}
          params={params}
          depth={depth + 1}
          parentSlug={category.slug}
        />
      ))}
    </>
  );
}

export const CategorySidebar = memo(function CategorySidebar({
  locale,
  gameSlug,
  categories,
}: Props) {
  const t = useTranslations("games");
  const params = useSearchParams();
  const hasFilter = Boolean(params.get("category") || params.get("subcategory"));

  return (
    <nav className="space-y-3" aria-label={t("categories")}>
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {t("categories")}
      </h2>
      <Link
        href={buildHref(locale, gameSlug, params, { category: null, subcategory: null })}
        scroll={false}
        className={cn(
          "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all",
          !hasFilter
            ? "border-neon-purple/60 bg-neon-purple/10"
            : "border-border/40 hover:border-neon-purple/30"
        )}
      >
        {t("allCategories")}
      </Link>
      <div className="space-y-2 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
        {categories.map((cat) => (
          <CategoryRow
            key={cat.id}
            locale={locale}
            gameSlug={gameSlug}
            category={cat}
            params={params}
            depth={0}
          />
        ))}
      </div>
    </nav>
  );
});
