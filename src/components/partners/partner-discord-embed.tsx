"use client";

import { useEffect, useState } from "react";

type DiscordWidgetData = {
  id: string;
  name: string;
  instant_invite?: string;
  presence_count?: number;
  members?: { username: string; status?: string }[];
  channels?: { id: string; name: string; position: number }[];
};

function extractWidgetServerId(widgetUrl: string): string | null {
  try {
    const url = new URL(widgetUrl.startsWith("http") ? widgetUrl : `https://${widgetUrl}`);
    const match = url.pathname.match(/\/api\/servers\/(\d+)\/widget\.json/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export function PartnerDiscordEmbed({
  inviteUrl,
  widgetUrl,
}: {
  inviteUrl?: string | null;
  widgetUrl?: string | null;
}) {
  const [data, setData] = useState<DiscordWidgetData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!widgetUrl) return;
    const serverId = extractWidgetServerId(widgetUrl);
    const jsonUrl = serverId
      ? `https://discord.com/api/guilds/${serverId}/widget.json`
      : widgetUrl.includes("widget.json")
        ? widgetUrl
        : null;

    if (!jsonUrl) {
      setError("Invalid Discord widget URL");
      return;
    }

    fetch(jsonUrl)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Widget unavailable"))))
      .then((json: DiscordWidgetData) => setData(json))
      .catch(() => setError("Could not load Discord server info"));
  }, [widgetUrl]);

  if (!inviteUrl && !widgetUrl) return null;

  const joinUrl = inviteUrl ?? data?.instant_invite ?? null;

  return (
    <div className="rounded-xl border border-border/40 bg-background/40 p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Discord community</p>
          <h3 className="font-semibold">{data?.name ?? "Partner server"}</h3>
          {data?.presence_count != null && (
            <p className="text-sm text-emerald-400 mt-1">{data.presence_count} online now</p>
          )}
        </div>
        {joinUrl && (
          <a
            href={joinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-lg bg-[#5865F2] px-4 py-2 text-sm font-medium text-white hover:bg-[#4752C4] transition-colors"
          >
            Join Discord
          </a>
        )}
      </div>

      {error && <p className="text-xs text-muted-foreground">{error}</p>}

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

      {widgetUrl && (
        <div className="overflow-hidden rounded-lg border border-border/30">
          <iframe
            src={widgetUrl.includes("discord.com/widget")
              ? widgetUrl
              : data?.id
                ? `https://discord.com/widget?id=${data.id}&theme=dark`
                : undefined}
            width="100%"
            height="300"
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
