import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buildCategoryTree, categoryBreadcrumb, type FlatCategory } from "@/lib/categories";

function CategoryLinks({
  nodes,
  locale,
  gameSlug,
  activeSlug,
  depth = 0,
}: {
  nodes: ReturnType<typeof buildCategoryTree>;
  locale: string;
  gameSlug: string;
  activeSlug?: string;
  depth?: number;
}) {
  return (
    <>
      {nodes.map((node) => (
        <div key={node.id} className="flex flex-wrap items-center gap-2" style={{ marginLeft: depth * 12 }}>
          <Link href={`/${locale}/games/${gameSlug}?category=${node.slug}`}>
            <Badge
              variant={activeSlug === node.slug ? "default" : "outline"}
              className="hover:border-neon-purple/50 transition-colors"
            >
              {node.name}
            </Badge>
          </Link>
          {node.children.length > 0 && (
            <CategoryLinks
              nodes={node.children}
              locale={locale}
              gameSlug={gameSlug}
              activeSlug={activeSlug}
              depth={depth + 1}
            />
          )}
        </div>
      ))}
    </>
  );
}

export function CategoryNav({
  locale,
  gameSlug,
  categories,
  activeSlug,
  allLabel,
}: {
  locale: string;
  gameSlug: string;
  categories: FlatCategory[];
  activeSlug?: string;
  allLabel: string;
}) {
  const tree = buildCategoryTree(categories);
  const breadcrumb = activeSlug
    ? categoryBreadcrumb(
        categories,
        categories.find((c) => c.slug === activeSlug)?.id ?? ""
      )
    : [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-3">
      {breadcrumb.length > 0 && (
        <nav className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <Link href={`/${locale}/games/${gameSlug}`} className="hover:text-foreground transition-colors">
            {allLabel}
          </Link>
          {breadcrumb.map((c) => (
            <span key={c.id} className="flex items-center gap-1.5">
              <span>/</span>
              <Link
                href={`/${locale}/games/${gameSlug}?category=${c.slug}`}
                className="hover:text-foreground transition-colors"
              >
                {c.name}
              </Link>
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap gap-2 items-start">
        <Link href={`/${locale}/games/${gameSlug}`}>
          <Badge variant={!activeSlug ? "default" : "outline"}>{allLabel}</Badge>
        </Link>
        <CategoryLinks nodes={tree} locale={locale} gameSlug={gameSlug} activeSlug={activeSlug} />
      </div>
    </div>
  );
}
