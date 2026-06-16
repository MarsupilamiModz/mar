import Link from "next/link";
import { Music, Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getAdminMods } from "@/actions/mods";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Locale } from "@/i18n/config";

export default async function AdminModsPage({
  params: { locale },
  searchParams,
}: {
  params: { locale: Locale };
  searchParams: { page?: string; type?: string };
}) {
  const t = await getTranslations("admin");
  const result = await getAdminMods({
    page: Number(searchParams.page) || 1,
    productType: (searchParams.type as "MOD" | "SOUND" | "ALL") || undefined,
  });
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
        <div className="flex gap-2">
          <Button variant={searchParams.type === "MOD" ? "default" : "outline"} size="sm" asChild>
            <Link href={`/${locale}/admin/mods?type=MOD`}>Mods</Link>
          </Button>
          <Button variant={searchParams.type === "SOUND" ? "default" : "outline"} size="sm" asChild>
            <Link href={`/${locale}/admin/mods?type=SOUND`}>Sounds</Link>
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

      <div className="mt-8 glass rounded-xl border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Mod</TableHead>
              <TableHead>Game</TableHead>
              <TableHead>Author</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Pricing</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.mods.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  {t("noMods")}
                </TableCell>
              </TableRow>
            ) : (
              data.mods.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <Badge variant="outline">{m.productType ?? "MOD"}</Badge>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/${locale}/mods/${m.slug}`}
                      className="font-medium hover:text-neon-purple"
                    >
                      {m.title}
                    </Link>
                  </TableCell>
                  <TableCell>{m.game.name}</TableCell>
                  <TableCell>@{m.author.username}</TableCell>
                  <TableCell><Badge variant="outline">{m.status}</Badge></TableCell>
                  <TableCell><Badge variant="outline">{m.pricing}</Badge></TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/${locale}/admin/mods/${m.id}`}>{t("editMod")}</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
