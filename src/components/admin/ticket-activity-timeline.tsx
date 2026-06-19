"use client";

import { safeToLocaleDateString } from "@/lib/i18n/safe-locale";

const ACTION_LABELS: Record<string, string> = {
  "ticket.status_change": "Status changed",
  "ticket.assign": "Assignment updated",
  "ticket.claim": "Ticket claimed",
  "ticket.escalate": "Escalated",
  "ticket.transfer": "Department transfer",
  "ticket.tags_update": "Tags updated",
};

type ActivityRow = {
  id: string;
  action: string;
  metadata: unknown;
  createdAt: Date;
  actor: string;
};

export function TicketActivityTimeline({ activities }: { activities: ActivityRow[] }) {
  if (activities.length === 0) {
    return <p className="text-xs text-muted-foreground">No activity recorded yet.</p>;
  }

  return (
    <ul className="space-y-3 max-h-64 overflow-y-auto">
      {activities.map((a) => (
        <li key={a.id} className="border-l-2 border-neon-purple/30 pl-3 text-xs">
          <p className="font-medium">{ACTION_LABELS[a.action] ?? a.action}</p>
          <p className="text-muted-foreground">
            {a.actor} · {safeToLocaleDateString(new Date(a.createdAt), undefined, { dateStyle: "short", timeStyle: "short" })}
          </p>
          {formatMetadataBlock(a.metadata)}
        </li>
      ))}
    </ul>
  );
}

function formatMetadataBlock(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return null;
  const text = formatMetadata(metadata as Record<string, unknown>);
  if (!text) return null;
  return <p className="text-muted-foreground/80 mt-0.5 font-mono text-[10px]">{text}</p>;
}

function formatMetadata(meta: Record<string, unknown>): string {
  if ("from" in meta && "to" in meta) return `${String(meta.from)} → ${String(meta.to)}`;
  if ("assigneeId" in meta) return meta.assigneeId ? "Assigned" : "Unassigned";
  if ("department" in meta) return String(meta.department);
  if ("tags" in meta && Array.isArray(meta.tags)) return (meta.tags as string[]).join(", ");
  return JSON.stringify(meta);
}
