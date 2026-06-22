import Link from "next/link";
import { Music, Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getAdminMods } from "@/actions/mods";
import { getGamesAndCategories } from "@/lib/data";
import { AdminModsTable } from "@/components/admin/admin-mods-table";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";

export default async function AdminModsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ page?: string; type?: string; status?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;

  const t = await getTranslations("admin");
  const [result, games] = await Promise.all([
    getAdminMods({
      page: Number(sp.page) || 1,
      productType: (sp.type as "MOD" | "SOUND" | "ALL") || undefined,
      status: sp.status as "ARCHIVED" | "PUBLISHED" | "PENDING" | undefined,
    }),
    getGamesAndCategories(),
  ]);
  const data = result.success ? result.data : { mods: [], total: 0, pages: 0, page: 1 };

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
          <Button variant={!sp.type ? "default" : "outline"} size="sm" asChild>
            <Link href={`/${locale}/admin/mods`}>All</Link>
          </Button>
          <Button variant={sp.type === "MOD" ? "default" : "outline"} size="sm" asChild>
            <Link href={`/${locale}/admin/mods?type=MOD`}>Mods</Link>
          </Button>
          <Button variant={sp.type === "SOUND" ? "default" : "outline"} size="sm" asChild>
            <Link href={`/${locale}/admin/mods?type=SOUND`}>Sounds</Link>
          </Button>
          <Button variant={sp.status === "ARCHIVED" ? "default" : "outline"} size="sm" asChild>
            <Link href={`/${locale}/admin/mods?status=ARCHIVED`}>Archived</Link>
          </Button>
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

      <div className="mt-8 glass rounded-xl border border-border/50 overflow-hidden p-4">
        <AdminModsTable
          locale={locale}
          mods={data.mods}
          games={games}
          emptyMessage={t("noMods")}
          editLabel={t("editMod")}
        />
      </div>
    </div>
  );
}
