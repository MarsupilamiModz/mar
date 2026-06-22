"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Archive, Check, RotateCcw, Trash2, X } from "lucide-react";
import { bulkModAdminAction, bulkReassignMods } from "@/actions/mods";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type FlatCategory } from "@/lib/categories";
import { useAppToast } from "@/hooks/use-app-toast";

type ModRow = {
  id: string;
  slug: string;
  title: string;
  status: string;
  pricing: string;
  productType: string | null;
  game: { name: string };
  mode: { name: string } | null;
  category: { name: string } | null;
  author: { username: string };
};

type GameCatalog = {
  id: string;
  name: string;
  modes: { id: string; name: string }[];
  categories: FlatCategory[];
};

type Props = {
  locale: string;
  mods: ModRow[];
  games: GameCatalog[];
  emptyMessage: string;
  editLabel: string;
};

export function AdminModsTable({ locale, mods, games, emptyMessage, editLabel }: Props) {
  const t = useTranslations("admin");
  const router = useRouter();
  const appToast = useAppToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [reassignGameId, setReassignGameId] = useState("");
  const [reassignModeId, setReassignModeId] = useState("");
  const [reassignCategoryId, setReassignCategoryId] = useState("");

  const allSelected = mods.length > 0 && selected.size === mods.length;

  const reassignGame = games.find((g) => g.id === reassignGameId);
  const reassignModes = reassignGame?.modes ?? [];
  const reassignCategories = useMemo(
    () =>
      (reassignGame?.categories ?? []).filter(
        (c) => !reassignModeId || !c.modeId || c.modeId === reassignModeId
      ),
    [reassignGame?.categories, reassignModeId]
  );

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(mods.map((m) => m.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function runBulk(action: "approve" | "reject" | "archive" | "restore" | "delete") {
    const ids = Array.from(selected);
    if (!ids.length) return;
    const confirmMsg =
      action === "delete"
        ? "Permanently delete selected mods? This cannot be undone."
        : `Apply ${action} to ${ids.length} mod(s)?`;
    if (!window.confirm(confirmMsg)) return;

    startTransition(async () => {
      const r = await bulkModAdminAction({ ids, action });
      if (r.success) {
        appToast.updated(`Bulk ${action} completed`);
        setSelected(new Set());
        router.refresh();
      } else {
        appToast.error(r.error);
      }
    });
  }

  function runReassign() {
    const ids = Array.from(selected);
    if (!ids.length) return;
    if (!reassignGameId && !reassignModeId && !reassignCategoryId) return;

    startTransition(async () => {
      const r = await bulkReassignMods({
        ids,
        ...(reassignGameId ? { gameId: reassignGameId } : {}),
        ...(reassignModeId ? { modeId: reassignModeId } : {}),
        ...(reassignCategoryId ? { categoryId: reassignCategoryId } : {}),
      });
      if (r.success) {
        appToast.updated(t("reassignApplied"));
        setSelected(new Set());
        setReassignGameId("");
        setReassignModeId("");
        setReassignCategoryId("");
        router.refresh();
      } else {
        appToast.error(r.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      {selected.size > 0 && (
        <div className="space-y-3 rounded-lg border border-neon-purple/30 bg-neon-purple/5 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{selected.size} selected</span>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => runBulk("approve")}>
              <Check className="h-3.5 w-3.5 mr-1" /> Approve
            </Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => runBulk("reject")}>
              <X className="h-3.5 w-3.5 mr-1" /> Reject
            </Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => runBulk("archive")}>
              <Archive className="h-3.5 w-3.5 mr-1" /> Soft delete
            </Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => runBulk("restore")}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restore
            </Button>
            <Button size="sm" variant="destructive" disabled={pending} onClick={() => runBulk("delete")}>
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Permanent delete
            </Button>
          </div>

          <div className="flex flex-wrap items-end gap-2 border-t border-neon-purple/20 pt-3">
            <span className="text-xs font-medium text-muted-foreground w-full sm:w-auto">
              {t("bulkReassignMods")}
            </span>
            <Select
              value={reassignGameId || "__none__"}
              onValueChange={(v) => {
                setReassignGameId(v === "__none__" ? "" : v);
                setReassignModeId("");
                setReassignCategoryId("");
              }}
            >
              <SelectTrigger className="h-8 w-[140px]">
                <SelectValue placeholder={t("reassignGame")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t("reassignGame")}</SelectItem>
                {games.map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {reassignModes.length > 0 && (
              <Select
                value={reassignModeId || "__none__"}
                onValueChange={(v) => {
                  setReassignModeId(v === "__none__" ? "" : v);
                  setReassignCategoryId("");
                }}
              >
                <SelectTrigger className="h-8 w-[140px]">
                  <SelectValue placeholder={t("reassignMode")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t("reassignMode")}</SelectItem>
                  {reassignModes.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select
              value={reassignCategoryId || "__none__"}
              onValueChange={(v) => setReassignCategoryId(v === "__none__" ? "" : v)}
            >
              <SelectTrigger className="h-8 w-[160px]">
                <SelectValue placeholder={t("reassignCategory")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t("reassignCategory")}</SelectItem>
                {reassignCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.parentId ? `↳ ${c.name}` : c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="neon"
              disabled={pending || (!reassignGameId && !reassignModeId && !reassignCategoryId)}
              onClick={runReassign}
            >
              {t("bulkReassign")}
            </Button>
          </div>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                aria-label="Select all"
                className="rounded border-border"
              />
            </TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Mod</TableHead>
            <TableHead>Game</TableHead>
            <TableHead>{t("reassignMode")}</TableHead>
            <TableHead>{t("reassignCategory")}</TableHead>
            <TableHead>Author</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Pricing</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {mods.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            mods.map((m) => (
              <TableRow key={m.id} data-state={selected.has(m.id) ? "selected" : undefined}>
                <TableCell>
                  <input
                    type="checkbox"
                    checked={selected.has(m.id)}
                    onChange={() => toggleOne(m.id)}
                    aria-label={`Select ${m.title}`}
                    className="rounded border-border"
                  />
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{m.productType ?? "MOD"}</Badge>
                </TableCell>
                <TableCell>
                  <Link href={`/${locale}/mods/${m.slug}`} className="font-medium hover:text-neon-purple">
                    {m.title}
                  </Link>
                </TableCell>
                <TableCell>{m.game.name}</TableCell>
                <TableCell className="text-muted-foreground">{m.mode?.name ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{m.category?.name ?? "—"}</TableCell>
                <TableCell>@{m.author.username}</TableCell>
                <TableCell>
                  <Badge variant={m.status === "ARCHIVED" ? "destructive" : "outline"}>{m.status}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{m.pricing}</Badge>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/${locale}/admin/mods/${m.id}`}>{editLabel}</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
