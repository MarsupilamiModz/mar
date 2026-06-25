"use client";

import { memo, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { PartnerDiscordConfig } from "@/lib/partner-discord";

type DiscordWidgetData = {
  id: string;
  name: string;
  instant_invite?: string;
  presence_count?: number;
  channels?: { id: string; name: string; position: number }[];
};

function PartnerDiscordEmbedInner({ config }: { config: PartnerDiscordConfig }) {
  const [data, setData] = useState<DiscordWidgetData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(config.serverId && config.widgetEnabled));

  useEffect(() => {
    if (!config.serverId || !config.widgetEnabled) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetch(`/api/discord/widget?serverId=${encodeURIComponent(config.serverId)}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? "Widget unavailable");
        }
        return res.json() as Promise<DiscordWidgetData>;
      })
      .then((json) => {
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load Discord server info");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [config.serverId, config.widgetEnabled]);

  const joinUrl = config.inviteUrl ?? data?.instant_invite ?? null;
  const showWidget = config.widgetEnabled && config.widgetUrl;

  return (
    <div className="rounded-xl border border-[#5865F2]/30 bg-gradient-to-br from-[#5865F2]/10 to-background/40 p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Discord community</p>
          <h3 className="text-lg font-semibold mt-1">{data?.name ?? "Partner server"}</h3>
          {config.description && (
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{config.description}</p>
          )}
          {loading && <p className="text-xs text-muted-foreground mt-2">Loading server info…</p>}
          {!loading && data?.presence_count != null && (
            <p className="text-sm text-emerald-400 mt-2">{data.presence_count} online now</p>
          )}
          {error && <p className="text-xs text-amber-400 mt-2">{error}</p>}
        </div>
        {joinUrl && (
          <a
            href={joinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center rounded-lg bg-[#5865F2] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#4752C4] transition-colors shadow-lg shadow-[#5865F2]/20"
          >
            Join Discord
          </a>
        )}
      </div>

      {data?.channels && data.channels.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Channels</p>
          <ul className="grid gap-1 sm:grid-cols-2 text-sm">
            {data.channels.slice(0, 8).map((ch) => (
              <li key={ch.id} className="text-muted-foreground truncate">
                # {ch.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {showWidget && (
        <div className="overflow-hidden rounded-lg border border-border/30 bg-black/20">
          <iframe
            src={config.widgetUrl!}
            width="100%"
            height="320"
            loading="lazy"
            allowTransparency
            sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
            className="w-full border-0 bg-transparent"
            title="Discord server widget"
          />
        </div>
      )}
    </div>
  );
}

export const PartnerDiscordEmbed = memo(function PartnerDiscordEmbed({
  config,
}: {
  config: PartnerDiscordConfig;
}) {
  return <PartnerDiscordEmbedInner config={config} />;
});

export const PartnerDiscordSection = dynamic(
  () => Promise.resolve({ default: PartnerDiscordEmbed }),
  {
    ssr: false,
    loading: () => (
      <div className="h-48 animate-pulse rounded-xl border border-border/40 bg-muted/20" />
    ),
  }
);
