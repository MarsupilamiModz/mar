"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, Check, RotateCcw, Trash2, X } from "lucide-react";
import { bulkModAdminAction } from "@/actions/mods";
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
import { useAppToast } from "@/hooks/use-app-toast";

type ModRow = {
  id: string;
  slug: string;
  title: string;
  status: string;
  pricing: string;
  productType: string | null;
  game: { name: string };
  author: { username: string };
};

type Props = {
  locale: string;
  mods: ModRow[];
  emptyMessage: string;
  editLabel: string;
};

export function AdminModsTable({ locale, mods, emptyMessage, editLabel }: Props) {
  const router = useRouter();
  const appToast = useAppToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const allSelected = mods.length > 0 && selected.size === mods.length;

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

  return (
    <div className="space-y-4">
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-neon-purple/30 bg-neon-purple/5 p-3">
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
            <TableHead>Author</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Pricing</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {mods.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
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
