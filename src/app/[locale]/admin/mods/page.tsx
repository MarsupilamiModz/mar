import Link from "next/link";
import { Music, Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ModStatus } from "@prisma/client";
import { getAdminMods } from "@/actions/mods";
import { getGamesAndCategories } from "@/lib/data";
import { AdminModsTable } from "@/components/admin/admin-mods-table";
import { AdminModsToolbar } from "@/components/admin/admin-mods-toolbar";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { Button } from "@/components/ui/button";
import { parseAdminLimit, parseAdminPage } from "@/lib/admin-pagination";
import type { Locale } from "@/i18n/config";

type SearchParams = {
  page?: string;
  limit?: string;
  type?: string;
  status?: string;
  pricing?: string;
  sort?: string;
  q?: string;
  gameId?: string;
  featured?: string;
  scheduled?: string;
};

const VALID_STATUS = new Set<ModStatus>(["DRAFT", "PENDING", "PUBLISHED", "REJECTED", "ARCHIVED"]);

export default async function AdminModsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  const sp = await searchParams;

  const page = parseAdminPage(sp.page);
  const limit = parseAdminLimit(sp.limit);
  const status = sp.status && VALID_STATUS.has(sp.status as ModStatus) ? (sp.status as ModStatus) : undefined;

  const t = await getTranslations("admin");
  const [result, games] = await Promise.all([
    getAdminMods({
      page,
      limit,
      search: sp.q,
      productType: (sp.type as "MOD" | "SOUND") || undefined,
      status,
      gameId: sp.gameId,
      pricing: sp.pricing === "FREE" || sp.pricing === "PREMIUM" ? sp.pricing : undefined,
      featured: sp.featured === "1",
      scheduled: sp.scheduled === "1",
      sort:
        sp.sort === "oldest" ||
        sp.sort === "downloads" ||
        sp.sort === "rating" ||
        sp.sort === "alpha"
          ? sp.sort
          : "newest",
    }),
    getGamesAndCategories(),
  ]);
  const data = result.success
    ? result.data
    : { mods: [], total: 0, pages: 1, page: 1, limit };

  const basePath = `/${locale}/admin/mods`;
  const queryParams: Record<string, string | undefined> = {
    type: sp.type,
    status: sp.status,
    pricing: sp.pricing,
    sort: sp.sort,
    q: sp.q,
    gameId: sp.gameId,
    featured: sp.featured,
    scheduled: sp.scheduled,
    limit: String(limit),
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("modManagement")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("modTotal", { count: data.total })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="neon" size="sm" asChild>
            <Link href={`/${locale}/admin/mods/new`}>
              <Plus className="h-4 w-4 mr-1" /> {t("uploadMod")}
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/${locale}/admin/mods/new-sound`}>
              <Music className="h-4 w-4 mr-1" /> {t("uploadSound")}
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-6">
        <AdminModsToolbar
          locale={locale}
          searchParams={sp}
          games={games.map((g) => ({ id: g.id, name: g.name }))}
        />
      </div>

      <div className="mt-8 glass rounded-xl border border-border/50 overflow-hidden p-4">
        <AdminModsTable
          locale={locale}
          mods={data.mods}
          games={games}
          emptyMessage={t("noMods")}
          editLabel={t("editMod")}
        />
        <AdminPagination
          page={data.page}
          pages={data.pages}
          total={data.total}
          limit={limit}
          basePath={basePath}
          searchParams={queryParams}
        />
      </div>
    </div>
  );
}
