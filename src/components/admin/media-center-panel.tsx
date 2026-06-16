"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { bulkMediaAction, type MediaSection } from "@/actions/admin/media-center";
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

const SECTIONS: MediaSection[] = [
  "mods",
  "sounds",
  "collections",
  "modpacks",
  "screenshots",
  "videos",
  "downloads",
];

type Props = {
  locale: string;
  section: MediaSection;
  items: unknown[];
  total: number;
  page: number;
  pages: number;
};

export function MediaCenterPanel({ locale, section, items, total, page, pages }: Props) {
  const t = useTranslations("admin");
  const appToast = useAppToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string[]>([]);
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const runBulk = (action: "approve" | "reject" | "feature" | "archive" | "delete") => {
    if (!selected.length) return;
    startTransition(async () => {
      const r = await bulkMediaAction({ section, ids: selected, action });
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
          <Button
            key={s}
            variant={section === s ? "default" : "outline"}
            size="sm"
            asChild
          >
            <Link href={`/${locale}/admin/media?section=${s}`}>{t(`mediaSection.${s}`)}</Link>
          </Button>
        ))}
      </div>

      <Card className="glass p-4">
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
          <Button type="submit" variant="outline" size="sm">{t("searchPlaceholder")}</Button>
        </form>

        <div className="flex flex-wrap gap-2 mt-4">
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
      </Card>

      <div className="glass rounded-xl border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>{t("mediaItem")}</TableHead>
              <TableHead>{t("mediaMeta")}</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                  {t("mediaEmpty")}
                </TableCell>
              </TableRow>
            ) : (
              items.map((raw) => {
                const item = raw as Record<string, unknown>;
                const id = String(item.id);
                let title = "—";
                let meta = "";
                let href: string | null = null;

                if (section === "mods" || section === "sounds") {
                  title = String(item.title);
                  meta = `${(item.game as { name: string })?.name ?? ""} · @${(item.author as { username: string })?.username ?? ""} · ${String(item.status)}`;
                  href = `/${locale}/admin/mods/${id}`;
                } else if (section === "collections") {
                  title = String(item.title);
                  meta = `@${(item.owner as { username: string })?.username ?? ""} · ${(item._count as { items: number })?.items ?? 0} items`;
                } else if (section === "screenshots" || section === "videos") {
                  const mod = item.mod as { title: string; id: string };
                  title = mod?.title ?? id;
                  meta = section;
                  href = mod ? `/${locale}/admin/mods/${mod.id}` : null;
                } else if (section === "downloads") {
                  const mod = (item.version as { mod: { title: string; slug: string } })?.mod;
                  title = mod?.title ?? id;
                  meta = `@${(item.user as { username: string })?.username ?? "guest"}`;
                }

                return (
                  <TableRow key={id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selected.includes(id)}
                        onChange={() => toggle(id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{title}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{meta}</Badge>
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
