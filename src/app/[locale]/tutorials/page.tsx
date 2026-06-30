import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { listPublishedTutorials, listTutorialCategories } from "@/lib/tutorials/data";
import { TutorialCard } from "@/components/tutorials/tutorial-card";
import { Badge } from "@/components/ui/badge";
import type { Locale } from "@/i18n/config";
import type { TutorialLevel } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function TutorialsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ category?: string; level?: string; q?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const level = sp.level as TutorialLevel | undefined;
  const [tutorials, categories] = await Promise.all([
    listPublishedTutorials({
      categorySlug: sp.category,
      level: level && ["BEGINNER", "INTERMEDIATE", "ADVANCED"].includes(level) ? level : undefined,
      q: sp.q,
    }),
    listTutorialCategories(),
  ]);

  return (
    <div className="page-section">
      <div className="mb-10">
        <Badge variant="outline" className="mb-3">
          Tutorial Center
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight">Tutorials</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Schritt-für-Schritt Anleitungen für Modding, Installation und Fehlerbehebung.
        </p>
      </div>

      <div className="mb-8 flex flex-wrap gap-2">
        <Link
          href={`/${locale}/tutorials`}
          className={`filter-pill ${!sp.category ? "filter-pill-active" : ""}`}
        >
          Alle
        </Link>
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/${locale}/tutorials?category=${c.slug}`}
            className={`filter-pill ${sp.category === c.slug ? "filter-pill-active" : ""}`}
          >
            {c.name}
          </Link>
        ))}
      </div>

      <div className="mb-8 flex flex-wrap gap-2">
        {(["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const).map((lv) => (
          <Link
            key={lv}
            href={`/${locale}/tutorials?level=${lv}${sp.category ? `&category=${sp.category}` : ""}`}
            className={`text-xs uppercase tracking-wide px-2 py-1 rounded border ${sp.level === lv ? "border-neon-purple/60 text-neon-purple" : "border-border/40 text-muted-foreground"}`}
          >
            {lv === "BEGINNER" ? "Anfänger" : lv === "INTERMEDIATE" ? "Fortgeschritten" : "Profi"}
          </Link>
        ))}
      </div>

      {tutorials.length === 0 ? (
        <p className="text-muted-foreground">Noch keine Tutorials veröffentlicht.</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {tutorials.map((t) => (
            <TutorialCard key={t.id} locale={locale} tutorial={t} />
          ))}
        </div>
      )}
    </div>
  );
}
