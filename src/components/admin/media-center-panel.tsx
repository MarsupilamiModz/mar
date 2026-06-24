"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { bulkMediaAction, type BulkMediaAction, type MediaSection } from "@/actions/admin/media-center";
import {
  adminRepairAllMedia,
  adminScanMissingMedia,
} from "@/actions/admin/media-repair";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAppToast } from "@/hooks/use-app-toast";
import { scanStatusLabel, scanStatusVariant } from "@/lib/scan-status-labels";

const SECTIONS: MediaSection[] = [
  "mods",
  "sounds",
  "collections",
  "screenshots",
  "avatars",
  "banners",
  "videos",
  "files",
  "downloads",
  "modpacks",
];

type Props = {
  locale: string;
  section: MediaSection;
  items: unknown[];
  total: number;
  page: number;
  pages: number;
};

function itemId(raw: unknown): string {
  return String((raw as Record<string, unknown>).id);
}

export function MediaCenterPanel({ locale, section, items, total, page, pages }: Props) {
  const t = useTranslations("admin");
  const appToast = useAppToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string[]>([]);
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [repairResult, setRepairResult] = useState<string | null>(null);
  const [gameId, setGameId] = useState("");
  const [ownerId, setOwnerId] = useState("");

  const pageIds = useMemo(() => items.map(itemId), [items]);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.includes(id));

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectAllOnPage = () => setSelected(pageIds);
  const clearSelection = () => setSelected([]);

  const confirmBulk = (action: BulkMediaAction, count: number) => {
    const label = t(`mediaBulkAction.${action}`);
    return window.confirm(t("mediaBulkConfirm", { count, action: label }));
  };

  const runBulk = (action: BulkMediaAction) => {
    if (!selected.length) return;
    if (!confirmBulk(action, selected.length)) return;
    startTransition(async () => {
      const r = await bulkMediaAction({
        section,
        ids: selected,
        action,
        gameId: action === "changeGame" ? gameId.trim() || undefined : undefined,
        ownerId: action === "changeOwner" ? ownerId.trim() || undefined : undefined,
      });
      if (r.success) {
        appToast.saved();
        setSelected([]);
        router.refresh();
      } else appToast.error(r.error);
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("mediaCenter")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("mediaCenterHint", { count: total })}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {SECTIONS.map((s) => (
          <Button key={s} variant={section === s ? "default" : "outline"} size="sm" asChild>
            <Link href={`/${locale}/admin/media?section=${s}`}>{t(`mediaSection.${s}`)}</Link>
          </Button>
        ))}
      </div>

      <Card className="glass p-4 space-y-3">
        <h3 className="font-semibold text-sm">{t("mediaRepair")}</h3>
        <p className="text-xs text-muted-foreground">{t("mediaRepairHint")}</p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await adminScanMissingMedia();
                if (r.success) setRepairResult(t("mediaScanResult", { count: r.data.count }));
                else appToast.error(r.error);
              })
            }
          >
            {t("mediaScanMissing")}
          </Button>
          <Button
            size="sm"
            variant="neon"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await adminRepairAllMedia();
                if (r.success) {
                  setRepairResult(
                    t("mediaRepairResult", {
                      repaired: r.data.totalRepaired,
                      scanned: r.data.totalScanned,
                    })
                  );
                  appToast.saved();
                  router.refresh();
                } else appToast.error(r.error);
              })
            }
          >
            {t("mediaRepairAll")}
          </Button>
        </div>
        {repairResult && <p className="text-xs text-emerald-400">{repairResult}</p>}
      </Card>

      <Card className="glass p-4 space-y-4">
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            router.push(`/${locale}/admin/media?section=${section}&q=${encodeURIComponent(q)}`);
          }}
        >
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="max-w-xs"
          />
          <Button type="submit" variant="outline" size="sm">
            {t("searchPlaceholder")}
          </Button>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" disabled={!pageIds.length} onClick={selectAllOnPage}>
            {t("mediaSelectAll")}
          </Button>
          <Button size="sm" variant="ghost" disabled={!selected.length} onClick={clearSelection}>
            {t("mediaClearSelection")}
          </Button>
          {selected.length > 0 && (
            <span className="text-xs text-muted-foreground">{t("mediaSelectedCount", { count: selected.length })}</span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={pending || !selected.length} onClick={() => runBulk("approve")}>
            {t("mediaApprove")}
          </Button>
          <Button size="sm" variant="outline" disabled={pending || !selected.length} onClick={() => runBulk("reject")}>
            {t("mediaReject")}
          </Button>
          <Button size="sm" variant="outline" disabled={pending || !selected.length} onClick={() => runBulk("feature")}>
            {t("featured")}
          </Button>
          <Button size="sm" variant="outline" disabled={pending || !selected.length} onClick={() => runBulk("archive")}>
            {t("mediaArchive")}
          </Button>
          <Button size="sm" variant="destructive" disabled={pending || !selected.length} onClick={() => runBulk("delete")}>
            {t("mediaDelete")}
          </Button>
        </div>

        {(section === "mods" || section === "sounds" || section === "collections") && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-border/40">
            <Input
              value={gameId}
              onChange={(e) => setGameId(e.target.value)}
              placeholder={t("mediaGameIdPlaceholder")}
              className="max-w-[14rem]"
            />
            <Button
              size="sm"
              variant="secondary"
              disabled={pending || !selected.length || !gameId.trim()}
              onClick={() => runBulk("changeGame")}
            >
              {t("mediaChangeGame")}
            </Button>
            <Input
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              placeholder={t("mediaOwnerIdPlaceholder")}
              className="max-w-[14rem]"
            />
            <Button
              size="sm"
              variant="secondary"
              disabled={pending || !selected.length || !ownerId.trim()}
              onClick={() => runBulk("changeOwner")}
            >
              {t("mediaChangeOwner")}
            </Button>
          </div>
        )}
      </Card>

      <div className="glass rounded-xl border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  aria-label={t("mediaSelectAll")}
                  checked={allOnPageSelected}
                  onChange={() => (allOnPageSelected ? clearSelection() : selectAllOnPage())}
                />
              </TableHead>
              <TableHead>{t("mediaItem")}</TableHead>
              <TableHead>{t("mediaMeta")}</TableHead>
              <TableHead>{t("mediaSecurity")}</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                  {t("mediaEmpty")}
                </TableCell>
              </TableRow>
            ) : (
              items.map((raw) => {
                const item = raw as Record<string, unknown>;
                const id = itemId(raw);
                let title = "—";
                let meta = "";
                let href: string | null = null;
                let scanStatus: string | null = null;

                if (section === "mods" || section === "sounds") {
                  title = String(item.title);
                  meta = `${(item.game as { name: string })?.name ?? ""} · @${(item.author as { username: string })?.username ?? ""} · ${String(item.status)}`;
                  href = `/${locale}/admin/mods/${id}`;
                  const primary = (item.versions as { scanStatus: string }[])?.[0];
                  scanStatus = primary?.scanStatus ?? null;
                } else if (section === "collections") {
                  title = String(item.title);
                  meta = `@${(item.owner as { username: string })?.username ?? ""} · ${(item._count as { items: number })?.items ?? 0} items`;
                } else if (section === "screenshots") {
                  const mod = item.mod as { title: string; id: string };
                  title = mod?.title ?? id;
                  meta = item.imageUrl ? String(item.imageUrl).slice(0, 48) : "screenshot";
                  href = mod ? `/${locale}/admin/mods/${mod.id}` : null;
                } else if (section === "avatars" || section === "banners" || section === "files") {
                  title = String(item.originalName ?? item.fileName ?? id);
                  meta = `@${(item.uploadedBy as { username: string })?.username ?? "—"} · ${String(item.entityType ?? "file")}`;
                } else if (section === "videos") {
                  const mod = item.mod as { title: string; id: string };
                  title = mod?.title ?? id;
                  meta = "video";
                  href = mod ? `/${locale}/admin/mods/${mod.id}` : null;
                } else if (section === "downloads") {
                  const mod = (item.version as { mod: { title: string; slug: string } })?.mod;
                  title = mod?.title ?? id;
                  meta = `@${(item.user as { username: string })?.username ?? "guest"}`;
                }

                return (
                  <TableRow key={id}>
                    <TableCell>
                      <input type="checkbox" checked={selected.includes(id)} onChange={() => toggle(id)} />
                    </TableCell>
                    <TableCell className="font-medium">{title}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{meta}</Badge>
                    </TableCell>
                    <TableCell>
                      {scanStatus ? (
                        <Badge variant={scanStatusVariant(scanStatus)}>{scanStatusLabel(scanStatus)}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {href && (
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={href}>{t("editMod")}</Link>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {pages > 1 && (
        <div className="flex gap-2">
          {page > 1 && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/${locale}/admin/media?section=${section}&page=${page - 1}`}>←</Link>
            </Button>
          )}
          <span className="text-sm text-muted-foreground self-center">
            {page} / {pages}
          </span>
          {page < pages && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/${locale}/admin/media?section=${section}&page=${page + 1}`}>→</Link>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
