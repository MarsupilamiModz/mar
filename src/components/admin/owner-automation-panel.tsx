"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import {
  saveDiscordAutomation,
  saveMediaTemplates,
  testDiscordWebhook,
} from "@/actions/admin/owner-automation";
import {
  DISCORD_CHANNEL_PRESETS,
  type DiscordAutomationSettings,
  type MediaTemplateSettings,
} from "@/lib/discord-automation";

type AuditRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: unknown;
  ipHash: string | null;
  createdAt: Date;
  actor: { username: string; displayName: string | null } | null;
};

export function OwnerAutomationPanel({
  locale,
  discord,
  mediaTemplates,
  auditLogs,
}: {
  locale: string;
  discord: DiscordAutomationSettings;
  mediaTemplates: MediaTemplateSettings;
  auditLogs: AuditRow[];
}) {
  const [pending, startTransition] = useTransition();
  const [discordSettings, setDiscordSettings] = useState(discord);
  const [templates, setTemplates] = useState(mediaTemplates);

  function updateChannel(id: string, patch: Partial<(typeof discordSettings.channels)[0]>) {
    setDiscordSettings((prev) => ({
      ...prev,
      channels: prev.channels.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Badge className="mb-2 bg-neon-purple/20 text-neon-purple border-neon-purple/40">
            Owner only
          </Badge>
          <h1 className="text-2xl font-bold">Owner Automation Center</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Discord webhooks, media templates, and enterprise audit logs.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/${locale}/admin/owner`}>Control Center</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/${locale}/admin/owner/health`}>System Health</Link>
          </Button>
        </div>
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle>Discord Automation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(
              [
                ["modUpload", "Mod upload"],
                ["soundUpload", "Sound upload"],
                ["collectionUpload", "Collection upload"],
                ["news", "News"],
                ["premiumPurchase", "Premium purchase"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm">{label}</span>
                <Switch
                  checked={discordSettings.triggers[key]}
                  onCheckedChange={(checked) =>
                    setDiscordSettings((prev) => ({
                      ...prev,
                      triggers: { ...prev.triggers, [key]: checked },
                    }))
                  }
                />
              </label>
            ))}
          </div>

          <div className="space-y-4">
            {DISCORD_CHANNEL_PRESETS.map((preset) => {
              const channel =
                discordSettings.channels.find((c) => c.id === preset.id) ??
                discordSettings.channels[0];
              return (
                <div key={preset.id} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{preset.label}</p>
                    <Switch
                      checked={channel.enabled}
                      onCheckedChange={(enabled) => updateChannel(preset.id, { enabled })}
                    />
                  </div>
                  <Input
                    placeholder="Webhook URL"
                    value={channel.webhookUrl}
                    onChange={(e) => updateChannel(preset.id, { webhookUrl: e.target.value })}
                  />
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Embed color (decimal)"
                      value={channel.embedColor}
                      onChange={(e) =>
                        updateChannel(preset.id, { embedColor: Number(e.target.value) || 0 })
                      }
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          const r = await testDiscordWebhook(preset.id);
                          if (r.success) toast({ title: "Test sent" });
                          else toast({ title: r.error, variant: "destructive" });
                        })
                      }
                    >
                      Test
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <Button
            variant="neon"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await saveDiscordAutomation(discordSettings);
                if (r.success) toast({ title: "Discord settings saved" });
                else toast({ title: r.error, variant: "destructive" });
              })
            }
          >
            Save Discord automation
          </Button>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle>Media Template System</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Required and optional fields for uploads.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["required", "image", "Image"],
                ["required", "video", "Video"],
                ["required", "downloadFile", "Download file"],
                ["optional", "trailer", "Trailer"],
                ["optional", "screenshots", "Screenshots"],
                ["optional", "gallery", "Gallery"],
              ] as const
            ).map(([group, key, label]) => (
              <label key={`${group}-${key}`} className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm">
                  {label}{" "}
                  <span className="text-muted-foreground">({group})</span>
                </span>
                <Switch
                  checked={
                    group === "required"
                      ? templates.required[key as keyof typeof templates.required]
                      : templates.optional[key as keyof typeof templates.optional]
                  }
                  onCheckedChange={(checked) =>
                    setTemplates((prev) =>
                      group === "required"
                        ? {
                            ...prev,
                            required: { ...prev.required, [key]: checked },
                          }
                        : {
                            ...prev,
                            optional: { ...prev.optional, [key]: checked },
                          }
                    )
                  }
                />
              </label>
            ))}
          </div>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await saveMediaTemplates(templates);
                if (r.success) toast({ title: "Media templates saved" });
                else toast({ title: r.error, variant: "destructive" });
              })
            }
          >
            Save media templates
          </Button>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle>Enterprise Audit Log</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-96 overflow-y-auto space-y-2">
            {auditLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No audit entries yet.</p>
            ) : (
              auditLogs.map((log) => (
                <div key={log.id} className="rounded border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{log.action}</Badge>
                    <span className="text-muted-foreground">{log.entityType}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1">
                    {log.actor?.displayName ?? log.actor?.username ?? "System"}
                    {log.ipHash ? ` · IP hash ${log.ipHash.slice(0, 8)}…` : ""}
                  </p>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
