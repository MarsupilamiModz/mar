"use client";

import { useState, useTransition } from "react";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createApiKeyAdmin, revokeApiKeyAdmin } from "@/actions/admin/api-keys";
import { API_KEY_PRESETS, API_SCOPES } from "@/lib/api-auth";
import { formatNumber } from "@/lib/format-locale";

type ApiKeyRow = {
  id: string;
  name: string;
  description: string | null;
  keyPrefix: string;
  scopes: string[];
  rateLimit: number;
  ipWhitelist: string[];
  isActive: boolean;
  requestCount: number;
  errorCount: number;
  uploadCount: number;
  uploadBytes: bigint | number;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  createdBy: { username: string };
};

type Totals = {
  _sum: {
    requestCount: number | null;
    errorCount: number | null;
    uploadCount: number | null;
    uploadBytes: bigint | number | null;
  };
  _count: number;
};

type ApiLog = {
  id: string;
  action: string;
  entityId: string | null;
  createdAt: Date;
  metadata: unknown;
};

const RATE_PRESETS = [
  { label: "100 / min", value: 100 },
  { label: "1,000 / min", value: 1000 },
  { label: "10,000 / min", value: 10000 },
  { label: "Unlimited", value: 100000 },
];

export function ApiKeysPanel({
  keys: initialKeys,
  totals,
  recentLogs,
}: {
  keys: ApiKeyRow[];
  totals: Totals;
  recentLogs: ApiLog[];
}) {
  const [keys, setKeys] = useState(initialKeys);
  const [pending, startTransition] = useTransition();
  const [revealed, setRevealed] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    preset: "readonly" as keyof typeof API_KEY_PRESETS,
    rateLimit: 1000,
    expiresAt: "",
    ipWhitelist: "",
  });

  function createKey() {
    startTransition(async () => {
      const preset = API_KEY_PRESETS[form.preset];
      const r = await createApiKeyAdmin({
        name: form.name,
        description: form.description || undefined,
        preset: form.preset,
        scopes: [],
        rateLimit: form.rateLimit || preset.rateLimit,
        expiresAt: form.expiresAt || undefined,
        ipWhitelist: form.ipWhitelist
          .split(/[\n,]/)
          .map((s) => s.trim())
          .filter(Boolean),
      });
      if (r.success) {
        setRevealed(r.data.key);
        toast({ title: "API key created — copy it now" });
        setForm({
          name: "",
          description: "",
          preset: "readonly",
          rateLimit: 1000,
          expiresAt: "",
          ipWhitelist: "",
        });
      } else toast({ title: r.error, variant: "destructive" });
    });
  }

  function revoke(id: string) {
    startTransition(async () => {
      const r = await revokeApiKeyAdmin(id);
      if (r.success) {
        setKeys((k) => k.map((x) => (x.id === id ? { ...x, isActive: false } : x)));
        toast({ title: "Key revoked" });
      }
    });
  }

  const uploadBytes = Number(totals._sum.uploadBytes ?? 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">API Center</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage API keys, upload access, rate limits, and audit logs. Auth via{" "}
          <code className="text-xs">Authorization: Bearer xm_…</code> or{" "}
          <code className="text-xs">x-api-key</code>.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="glass p-4">
          <p className="text-xs uppercase text-muted-foreground">Total requests</p>
          <p className="text-2xl font-bold tabular-nums">{formatNumber(totals._sum.requestCount ?? 0)}</p>
        </Card>
        <Card className="glass p-4">
          <p className="text-xs uppercase text-muted-foreground">Errors</p>
          <p className="text-2xl font-bold tabular-nums">{formatNumber(totals._sum.errorCount ?? 0)}</p>
        </Card>
        <Card className="glass p-4">
          <p className="text-xs uppercase text-muted-foreground">API uploads</p>
          <p className="text-2xl font-bold tabular-nums">{formatNumber(totals._sum.uploadCount ?? 0)}</p>
        </Card>
        <Card className="glass p-4">
          <p className="text-xs uppercase text-muted-foreground">Bandwidth</p>
          <p className="text-2xl font-bold tabular-nums">{(uploadBytes / (1024 * 1024)).toFixed(1)} MB</p>
        </Card>
      </div>

      {revealed && (
        <Card className="glass border-neon-purple/30">
          <CardContent className="pt-6">
            <p className="text-sm font-medium mb-2">New API key (shown once)</p>
            <code className="block p-3 rounded bg-muted text-xs break-all">{revealed}</code>
            <Button size="sm" className="mt-2" onClick={() => setRevealed(null)}>
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="glass">
        <CardHeader><CardTitle>Create API key</CardTitle></CardHeader>
        <CardContent className="space-y-4 max-w-2xl">
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(API_KEY_PRESETS).map(([id, preset]) => (
              <button
                key={id}
                type="button"
                onClick={() => setForm((f) => ({ ...f, preset: id as keyof typeof API_KEY_PRESETS, rateLimit: preset.rateLimit }))}
                className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                  form.preset === id ? "border-neon-purple bg-neon-purple/10" : "border-border/50"
                }`}
              >
                <p className="font-medium">{preset.label}</p>
                <p className="text-xs text-muted-foreground mt-1">{preset.rateLimit} req/min</p>
              </button>
            ))}
          </div>
          <div>
            <label className="text-sm font-medium">Name</label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Production upload key"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <Input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Used by desktop mod uploader"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Rate limit</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {RATE_PRESETS.map((p) => (
                <Button
                  key={p.value}
                  type="button"
                  size="sm"
                  variant={form.rateLimit === p.value ? "neon" : "outline"}
                  onClick={() => setForm((f) => ({ ...f, rateLimit: p.value }))}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Expiry (optional)</label>
            <Input
              type="date"
              value={form.expiresAt}
              onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm font-medium">IP whitelist (optional, comma-separated)</label>
            <Input
              value={form.ipWhitelist}
              onChange={(e) => setForm((f) => ({ ...f, ipWhitelist: e.target.value }))}
              placeholder="203.0.113.10, 198.51.100.0"
            />
          </div>
          <Button onClick={createKey} disabled={pending || !form.name.trim()}>
            Generate key
          </Button>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader><CardTitle>API keys</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {keys.length === 0 ? (
            <p className="text-sm text-muted-foreground">No API keys yet.</p>
          ) : (
            keys.map((key) => (
              <div key={key.id} className="rounded-lg border border-border/40 p-4 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{key.name}</p>
                    {key.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{key.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground font-mono mt-1">{key.keyPrefix}…</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={key.isActive ? "default" : "destructive"}>
                      {key.isActive ? "Active" : "Revoked"}
                    </Badge>
                    {key.isActive && (
                      <Button size="sm" variant="destructive" disabled={pending} onClick={() => revoke(key.id)}>
                        Revoke
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {key.scopes.map((s) => (
                    <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>
                  ))}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-muted-foreground">
                  <span>{formatNumber(key.requestCount)} requests</span>
                  <span>{formatNumber(key.errorCount)} errors</span>
                  <span>{formatNumber(key.uploadCount)} uploads</span>
                  <span>{key.rateLimit}/min limit</span>
                </div>
                {key.lastUsedAt && (
                  <p className="text-[10px] text-muted-foreground">
                    Last used {new Date(key.lastUsedAt).toLocaleString()}
                  </p>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader><CardTitle>Recent API audit log</CardTitle></CardHeader>
        <CardContent>
          {recentLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No API activity logged yet.</p>
          ) : (
            <ul className="space-y-2 text-sm max-h-64 overflow-y-auto">
              {recentLogs.map((log) => (
                <li key={log.id} className="flex justify-between gap-4 border-b border-border/30 pb-2">
                  <span>
                    <span className="font-mono text-xs">{log.action}</span>
                    {log.entityId && (
                      <span className="text-muted-foreground text-xs ml-2">key …{log.entityId.slice(-6)}</span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader><CardTitle>Upload API</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-2 text-muted-foreground">
          <p>
            <code className="text-foreground">POST /api/v1/upload</code> — multipart field{" "}
            <code className="text-foreground">file</code>
          </p>
          <p>Scopes: upload:write · Types: PNG, JPG, WEBP, GIF, MP3, WAV, OGG, ZIP, RAR, 7Z, DLL, ASI</p>
          <p>Response: url, fileName, size, hash, virusTotalStatus</p>
        </CardContent>
      </Card>
    </div>
  );
}
