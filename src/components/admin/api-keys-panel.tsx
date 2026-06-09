"use client";

import { useState, useTransition } from "react";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  createApiKeyAdmin,
  revokeApiKeyAdmin,
} from "@/actions/admin/api-keys";
import { API_SCOPES } from "@/lib/api-auth";

type ApiKeyRow = {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  rateLimit: number;
  isActive: boolean;
  lastUsedAt: Date | null;
  createdAt: Date;
  createdBy: { username: string };
};

export function ApiKeysPanel({ keys: initialKeys }: { keys: ApiKeyRow[] }) {
  const [keys, setKeys] = useState(initialKeys);
  const [pending, startTransition] = useTransition();
  const [newKey, setNewKey] = useState<{ name: string; scopes: string[]; rateLimit: number }>({
    name: "",
    scopes: ["mods:read"],
    rateLimit: 1000,
  });
  const [revealed, setRevealed] = useState<string | null>(null);

  function createKey() {
    startTransition(async () => {
      const r = await createApiKeyAdmin({
        name: newKey.name,
        scopes: newKey.scopes as never[],
        rateLimit: newKey.rateLimit,
      });
      if (r.success) {
        setRevealed(r.data.key);
        toast({ title: "API key created — copy it now" });
        setNewKey({ name: "", scopes: ["mods:read"], rateLimit: 1000 });
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

  return (
    <div className="space-y-6">
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
        <CardHeader><CardTitle>Create API Key</CardTitle></CardHeader>
        <CardContent className="space-y-4 max-w-lg">
          <div>
            <label className="text-sm font-medium">Name</label>
            <Input
              value={newKey.name}
              onChange={(e) => setNewKey((k) => ({ ...k, name: e.target.value }))}
              placeholder="Desktop client production"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Rate limit (req/min)</label>
            <Input
              type="number"
              value={newKey.rateLimit}
              onChange={(e) =>
                setNewKey((k) => ({ ...k, rateLimit: Number(e.target.value) || 1000 }))
              }
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {API_SCOPES.map((scope) => (
              <label key={scope} className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={newKey.scopes.includes(scope)}
                  onChange={(e) =>
                    setNewKey((k) => ({
                      ...k,
                      scopes: e.target.checked
                        ? [...k.scopes, scope]
                        : k.scopes.filter((s) => s !== scope),
                    }))
                  }
                />
                {scope}
              </label>
            ))}
          </div>
          <Button onClick={createKey} disabled={pending || !newKey.name.trim()}>
            Generate key
          </Button>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader><CardTitle>Active Keys</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {keys.length === 0 ? (
            <p className="text-sm text-muted-foreground">No API keys yet.</p>
          ) : (
            keys.map((key) => (
              <div
                key={key.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-border/30 pb-3"
              >
                <div>
                  <p className="font-medium">{key.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{key.keyPrefix}…</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {key.scopes.map((s) => (
                      <Badge key={s} variant="outline" className="text-[10px]">
                        {s}
                      </Badge>
                    ))}
                  </div>
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
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
