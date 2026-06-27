"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { formatNumber } from "@/lib/format-locale";
import {
  connectDiscordGuild,
  saveDiscordImportChannel,
  deleteDiscordImportChannel,
  saveDiscordImportRule,
  deleteDiscordImportRule,
  reviewDiscordImport,
  updateDiscordImportScanStatus,
} from "@/actions/admin/discord-import";
import type { DiscordImportType } from "@prisma/client";

type CenterData = Extract<
  Awaited<ReturnType<typeof import("@/actions/admin/discord-import").getDiscordImportCenterData>>,
  { success: true }
>["data"];

const IMPORT_TYPES: DiscordImportType[] = ["MOD", "SOUND", "COLLECTION", "NEWS", "GALLERY"];

const SCAN_LABELS: Record<string, string> = {
  PENDING: "In Prüfung",
  SCANNING: "In Prüfung",
  CLEAN: "Sicher",
  SUSPICIOUS: "Verdächtig",
  MANUAL_REVIEW: "Manuelle Prüfung",
};

const STATUS_LABELS: Record<string, string> = {
  PROCESSING: "Verarbeitung",
  PENDING_REVIEW: "Wartet auf Freigabe",
  NEEDS_LINK_REVIEW: "Link-Prüfung",
  APPROVED: "Genehmigt",
  REJECTED: "Abgelehnt",
  FAILED: "Fehler",
};

export function DiscordImportCenter({ locale, data }: { locale: string; data: CenterData }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const defaultTab = searchParams.get("tab") ?? "servers";

  const primaryGuild =
    data.guilds.find((g) => g.botConnected) ?? data.guilds[0] ?? null;

  const [channelForm, setChannelForm] = useState({
    channelId: "",
    channelName: "",
    importType: "MOD" as DiscordImportType,
    gameSlug: "",
    gameId: "",
  });

  const [ruleForm, setRuleForm] = useState({
    name: "",
    pattern: "",
    importType: "MOD" as DiscordImportType,
    gameSlug: "",
  });

  const pendingQueue = useMemo(
    () =>
      data.queue.filter(
        (e) =>
          e.status === "PENDING_REVIEW" ||
          e.status === "NEEDS_LINK_REVIEW" ||
          e.status === "PROCESSING"
      ),
    [data.queue]
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Badge className="mb-2 bg-neon-purple/20 text-neon-purple border-neon-purple/40">
            Owner only
          </Badge>
          <h1 className="text-2xl font-bold">Discord Import Center</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Discord channels as upload source — all imports land in the review queue as drafts.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/${locale}/owner`}>Owner Panel</Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Pending review" value={String(data.stats.pending)} />
        <StatCard label="Imported mods" value={String(data.stats.mods)} />
        <StatCard label="Imported sounds" value={String(data.stats.sounds)} />
        <StatCard label="Virus alerts" value={String(data.stats.suspicious)} />
      </div>

      <Tabs defaultValue={defaultTab} className="space-y-6">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="servers">Connected servers</TabsTrigger>
          <TabsTrigger value="channels">Import channels</TabsTrigger>
          <TabsTrigger value="rules">Import rules</TabsTrigger>
          <TabsTrigger value="queue">Review queue ({pendingQueue.length})</TabsTrigger>
          <TabsTrigger value="links">Link sources</TabsTrigger>
          <TabsTrigger value="stats">Statistics</TabsTrigger>
          <TabsTrigger value="mapping">User mapping</TabsTrigger>
        </TabsList>

        <TabsContent value="servers" className="space-y-4">
          <Card className="glass">
            <CardHeader>
              <CardTitle>Connected servers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.guilds.length === 0 ? (
                <p className="text-sm text-destructive">
                  No server registered yet. Start the import bot — it auto-detects your Discord
                  server.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Active guild: <code>{data.guildId ?? "—"}</code>
                  {data.envGuildId && data.guildId && data.envGuildId !== data.guildId ? (
                    <span className="block text-destructive mt-1">
                      DISCORD_GUILD_ID in .env ({data.envGuildId}) does not match bot guild (
                      {data.guildId}). Update .env and restart PM2.
                    </span>
                  ) : null}
                </p>
              )}
              <Button
                variant="neon"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const r = await connectDiscordGuild(primaryGuild?.id);
                    if (r.success) {
                      toast({ title: "Server connected" });
                      router.refresh();
                    } else toast({ title: r.error, variant: "destructive" });
                  })
                }
              >
                Authorize / sync bot server
              </Button>
              {data.guilds.map((g) => (
                <div key={g.id} className="rounded-lg border p-4 flex items-center gap-3">
                  {g.iconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={g.iconUrl} alt="" className="h-10 w-10 rounded-full" />
                  ) : null}
                  <div>
                    <p className="font-medium">{g.guildName}</p>
                    <p className="text-xs text-muted-foreground">
                      {g.botConnected ? "Bot connected" : "Bot offline"} · {g.guildId}
                    </p>
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Run the import bot: <code>npm run discord:import-bot</code> (PM2 recommended)
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="channels" className="space-y-4">
          <Card className="glass">
            <CardHeader>
              <CardTitle>Add import channel</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!primaryGuild ? (
                <p className="text-sm text-muted-foreground">
                  Start discord-import bot first — it registers your server automatically.
                </p>
              ) : (
                <>
                  {data.channelFetchError ? (
                    <p className="text-sm text-destructive rounded-md border border-destructive/30 p-3">
                      {data.channelFetchError}
                    </p>
                  ) : null}
                  {data.discordChannels.length > 0 ? (
                    <Select
                      value={channelForm.channelId}
                      onValueChange={(channelId) => {
                        const ch = data.discordChannels.find((c) => c.id === channelId);
                        setChannelForm((f) => ({
                          ...f,
                          channelId,
                          channelName: ch?.name ?? "",
                        }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Discord channel" />
                      </SelectTrigger>
                      <SelectContent>
                        {data.discordChannels.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            #{c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Input
                        placeholder="Channel ID (Developer Mode → Copy Channel ID)"
                        value={channelForm.channelId}
                        onChange={(e) =>
                          setChannelForm((f) => ({ ...f, channelId: e.target.value.trim() }))
                        }
                      />
                      <Input
                        placeholder="Channel name (e.g. mod-uploads)"
                        value={channelForm.channelName}
                        onChange={(e) =>
                          setChannelForm((f) => ({ ...f, channelName: e.target.value.trim() }))
                        }
                      />
                    </div>
                  )}
                  <Select
                    value={channelForm.importType}
                    onValueChange={(v) =>
                      setChannelForm((f) => ({ ...f, importType: v as DiscordImportType }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Import type" />
                    </SelectTrigger>
                    <SelectContent>
                      {IMPORT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={channelForm.gameId || "none"}
                    onValueChange={(v) =>
                      setChannelForm((f) => ({
                        ...f,
                        gameId: v === "none" ? "" : v,
                        gameSlug: data.games.find((g) => g.id === v)?.slug ?? "",
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Auto category (game)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Auto from channel name</SelectItem>
                      {data.games.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="neon"
                    disabled={pending || !channelForm.channelId}
                    onClick={() =>
                      startTransition(async () => {
                        const r = await saveDiscordImportChannel({
                          guildRecordId: primaryGuild.id,
                          channelId: channelForm.channelId,
                          channelName: channelForm.channelName,
                          importType: channelForm.importType,
                          gameSlug: channelForm.gameSlug || undefined,
                          gameId: channelForm.gameId || undefined,
                          enabled: true,
                        });
                        if (r.success) {
                          toast({ title: "Channel saved" });
                          router.refresh();
                        } else toast({ title: r.error, variant: "destructive" });
                      })
                    }
                  >
                    Save channel
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <div className="space-y-2">
            {data.channels.map((ch) => (
              <div key={ch.id} className="rounded-lg border p-4 flex flex-wrap items-center gap-3">
                <Badge variant="outline">#{ch.channelName}</Badge>
                <Badge>{ch.importType}</Badge>
                {ch.gameSlug ? <span className="text-xs text-muted-foreground">{ch.gameSlug}</span> : null}
                <Button
                  size="sm"
                  variant="destructive"
                  className="ml-auto"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const r = await deleteDiscordImportChannel(ch.id);
                      if (r.success) router.refresh();
                    })
                  }
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          <Card className="glass">
            <CardHeader>
              <CardTitle>Import rules</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {primaryGuild ? (
                <>
                  <Input
                    placeholder="Rule name"
                    value={ruleForm.name}
                    onChange={(e) => setRuleForm((f) => ({ ...f, name: e.target.value }))}
                  />
                  <Input
                    placeholder="Channel name pattern (e.g. ragemp)"
                    value={ruleForm.pattern}
                    onChange={(e) => setRuleForm((f) => ({ ...f, pattern: e.target.value }))}
                  />
                  <Button
                    variant="outline"
                    disabled={pending || !ruleForm.name || !ruleForm.pattern}
                    onClick={() =>
                      startTransition(async () => {
                        const r = await saveDiscordImportRule({
                          guildRecordId: primaryGuild.id,
                          ...ruleForm,
                        });
                        if (r.success) {
                          toast({ title: "Rule saved" });
                          router.refresh();
                        } else toast({ title: r.error, variant: "destructive" });
                      })
                    }
                  >
                    Add rule
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Connect a server first.</p>
              )}
            </CardContent>
          </Card>
          {data.rules.map((rule) => (
            <div key={rule.id} className="rounded-lg border p-3 flex items-center gap-2 text-sm">
              <span className="font-medium">{rule.name}</span>
              <code className="text-xs">{rule.pattern}</code>
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto"
                onClick={() =>
                  startTransition(async () => {
                    await deleteDiscordImportRule(rule.id);
                    router.refresh();
                  })
                }
              >
                Delete
              </Button>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="queue" className="space-y-4">
          {data.queue.length === 0 ? (
            <Card className="glass p-8 text-center text-muted-foreground">Review queue is empty.</Card>
          ) : (
            data.queue.map((entry) => (
              <Card key={entry.id} className="glass">
                <CardContent className="pt-6 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{entry.importType}</Badge>
                    <Badge variant="outline">{STATUS_LABELS[entry.status] ?? entry.status}</Badge>
                    <Badge
                      variant={
                        entry.scanStatus === "CLEAN"
                          ? "default"
                          : entry.scanStatus === "SUSPICIOUS"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      VT: {SCAN_LABELS[entry.scanStatus] ?? entry.scanStatus}
                    </Badge>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {new Date(entry.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <h3 className="font-semibold">{entry.title ?? "Untitled"}</h3>
                  {entry.description ? (
                    <p className="text-sm text-muted-foreground line-clamp-3">{entry.description}</p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    Discord: {entry.discordAuthorName ?? entry.discordAuthorId}
                    {entry.authorUser
                      ? ` → ${entry.authorUser.displayName ?? entry.authorUser.username}`
                      : " → unmapped"}
                  </p>
                  {entry.mod ? (
                    <p className="text-xs">
                      Draft mod:{" "}
                      <Link href={`/${locale}/mods/${entry.mod.slug}`} className="text-neon-purple hover:underline">
                        {entry.mod.title}
                      </Link>{" "}
                      ({entry.mod.status})
                    </p>
                  ) : null}
                  {entry.files.length > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {entry.files.length} file(s) on R2
                      {entry.files.some((f) => f.sourceUrl) ? " · includes link imports" : ""}
                    </p>
                  ) : null}
                  {entry.errorMessage ? (
                    <p className="text-xs text-destructive">{entry.errorMessage}</p>
                  ) : null}
                  {entry.status === "PENDING_REVIEW" || entry.status === "NEEDS_LINK_REVIEW" ? (
                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="neon"
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            const r = await reviewDiscordImport({ entryId: entry.id, action: "approve" });
                            if (r.success) {
                              toast({ title: "Approved — mod moved to pending moderation" });
                              router.refresh();
                            } else toast({ title: r.error, variant: "destructive" });
                          })
                        }
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            const r = await reviewDiscordImport({ entryId: entry.id, action: "reject" });
                            if (r.success) {
                              toast({ title: "Rejected" });
                              router.refresh();
                            } else toast({ title: r.error, variant: "destructive" });
                          })
                        }
                      >
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            const r = await updateDiscordImportScanStatus(entry.id, "CLEAN");
                            if (r.success) router.refresh();
                          })
                        }
                      >
                        Mark scan safe
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="links">
          <Card className="glass">
            <CardHeader>
              <CardTitle>Allowed link sources</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Direct downloads from Google Drive, Dropbox, GitHub releases, and direct URLs.
                Linkvertise requires manual review unless explicitly enabled.
              </p>
              <p className="text-xs text-muted-foreground">
                Max link download: {data.settings.maxLinkDownloadMb} MB · Providers:{" "}
                {data.settings.allowedProviders.join(", ")}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats">
          <Card className="glass">
            <CardHeader>
              <CardTitle>Import statistics</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Total imports" value={formatNumber(data.stats.total)} />
              <StatCard label="Success rate" value={`${data.stats.successRate}%`} />
              <StatCard label="Failed imports" value={String(data.stats.failed)} />
              <StatCard label="Virus findings" value={String(data.stats.suspicious)} />
              <StatCard
                label="Last import"
                value={
                  data.stats.lastImportAt
                    ? new Date(data.stats.lastImportAt).toLocaleString()
                    : "—"
                }
              />
            </CardContent>
          </Card>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mt-4">
            {(
              [
                ["Today", data.stats.periods.today],
                ["7 days", data.stats.periods.d7],
                ["30 days", data.stats.periods.d30],
                ["90 days", data.stats.periods.d90],
              ] as const
            ).map(([label, p]) => (
              <Card key={label} className="glass p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
                <p className="mt-1 text-lg font-bold">{p.total} imports</p>
                <p className="text-xs text-muted-foreground">
                  {p.mods} mods · {p.sounds} sounds · {p.pending} pending
                </p>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="mapping">
          <Card className="glass">
            <CardHeader>
              <CardTitle>Discord user mapping</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Users linked via Discord OAuth are automatically assigned as creators on import.
              </p>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {data.mappings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No linked Discord accounts yet.</p>
                ) : (
                  data.mappings.map((u) => (
                    <div key={u.id} className="rounded border p-3 text-sm flex justify-between gap-2">
                      <span>
                        {u.displayName ?? u.username}{" "}
                        <span className="text-muted-foreground">({u.role})</span>
                      </span>
                      <code className="text-xs">{u.discordId}</code>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="glass p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {sub ? <p className="text-xs text-muted-foreground mt-1">{sub}</p> : null}
    </Card>
  );
}
