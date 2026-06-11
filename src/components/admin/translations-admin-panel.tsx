"use client";

import { memo, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { locales, type Locale } from "@/i18n/config";
import {
  exportAdminMessages,
  importAdminMessages,
  listAdminMessages,
  updateAdminMessage,
} from "@/actions/admin/messages";

type MessageRow = { key: string; value: string };

function TranslationsAdminPanelInner() {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>("en");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<MessageRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [pending, startTransition] = useTransition();
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.key.toLowerCase().includes(q));
  }, [rows, search]);

  function load() {
    startTransition(async () => {
      const r = await listAdminMessages(locale, search.trim() || undefined);
      if (r.success) {
        setRows(r.data.entries);
        setLoaded(true);
      } else toast({ title: r.error, variant: "destructive" });
    });
  }

  function saveRow(key: string, value: string) {
    startTransition(async () => {
      const r = await updateAdminMessage(locale, key, value);
      if (r.success) {
        toast({ title: "Translation saved" });
        router.refresh();
      } else toast({ title: r.error, variant: "destructive" });
    });
  }

  function addKey() {
    if (!newKey.trim()) return;
    startTransition(async () => {
      const r = await updateAdminMessage(locale, newKey.trim(), newValue);
      if (r.success) {
        toast({ title: "Key added" });
        setNewKey("");
        setNewValue("");
        load();
        router.refresh();
      } else toast({ title: r.error, variant: "destructive" });
    });
  }

  function exportJson() {
    startTransition(async () => {
      const r = await exportAdminMessages(locale);
      if (!r.success) {
        toast({ title: r.error, variant: "destructive" });
        return;
      }
      const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `messages-${locale}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  function importJson(file: File) {
    startTransition(async () => {
      try {
        const text = await file.text();
        const payload = JSON.parse(text) as Record<string, string>;
        const r = await importAdminMessages(locale, payload, "merge");
        if (r.success) {
          toast({ title: "Import complete" });
          load();
          router.refresh();
        } else toast({ title: r.error, variant: "destructive" });
      } catch {
        toast({ title: "Invalid JSON file", variant: "destructive" });
      }
    });
  }

  return (
    <Card className="glass mt-8">
      <CardHeader>
        <CardTitle>Static translations</CardTitle>
        <p className="text-sm text-muted-foreground">
          View, search, edit, export, and import UI message keys. Overrides are stored in the database and merged at runtime with English fallback.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <select
            className="h-10 rounded-md border border-input bg-background/50 px-3 text-sm"
            value={locale}
            onChange={(e) => {
              setLocale(e.target.value as Locale);
              setLoaded(false);
            }}
          >
            {locales.map((l) => (
              <option key={l} value={l}>{l.toUpperCase()}</option>
            ))}
          </select>
          <Input
            placeholder="Search keys…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Button variant="outline" disabled={pending} onClick={load}>
            {loaded ? "Refresh" : "Load translations"}
          </Button>
          <Button variant="outline" disabled={pending} onClick={exportJson}>Export JSON</Button>
          <label className="inline-flex">
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) importJson(file);
                e.target.value = "";
              }}
            />
            <Button variant="outline" disabled={pending} asChild>
              <span>Import JSON</span>
            </Button>
          </label>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Input placeholder="New key (e.g. nav.collections)" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
          <Input placeholder="Translation value" value={newValue} onChange={(e) => setNewValue(e.target.value)} />
          <Button variant="neon" disabled={pending} onClick={addKey} className="sm:col-span-2 w-fit">
            Add translation key
          </Button>
        </div>

        {loaded && (
          <div className="max-h-[480px] overflow-y-auto space-y-2 border border-border/30 rounded-lg p-3">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground">No keys match your search.</p>
            ) : (
              filtered.slice(0, 200).map((row) => (
                <div key={row.key} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] items-center text-sm">
                  <code className="text-xs text-muted-foreground truncate">{row.key}</code>
                  <Input
                    defaultValue={row.value}
                    onBlur={(e) => {
                      if (e.target.value !== row.value) saveRow(row.key, e.target.value);
                    }}
                  />
                </div>
              ))
            )}
            {filtered.length > 200 && (
              <p className="text-xs text-muted-foreground">Showing first 200 of {filtered.length} keys — refine search to narrow results.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export const TranslationsAdminPanel = memo(TranslationsAdminPanelInner);
