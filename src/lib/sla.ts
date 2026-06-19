import type { TicketPriority } from "@prisma/client";

/** Response SLA in hours by priority */
const RESPONSE_HOURS: Record<TicketPriority, number> = {
  LOW: 48,
  NORMAL: 24,
  HIGH: 8,
  URGENT: 4,
  CRITICAL: 1,
};

/** Resolution SLA in hours by priority */
const RESOLVE_HOURS: Record<TicketPriority, number> = {
  LOW: 168,
  NORMAL: 72,
  HIGH: 48,
  URGENT: 24,
  CRITICAL: 8,
};

export function computeSlaDueDates(priority: TicketPriority, from = new Date()) {
  const responseMs = RESPONSE_HOURS[priority] * 60 * 60 * 1000;
  const resolveMs = RESOLVE_HOURS[priority] * 60 * 60 * 1000;
  return {
    slaResponseDueAt: new Date(from.getTime() + responseMs),
    slaResolveDueAt: new Date(from.getTime() + resolveMs),
  };
}

export function isSlaOverdue(due: Date | null | undefined, resolved = false) {
  if (!due || resolved) return false;
  return due.getTime() < Date.now();
}

export type SlaTimerState = {
  label: string;
  variant: "ok" | "warning" | "overdue" | "met";
  msRemaining: number;
};

/** Human-readable SLA countdown for UI. */
export function getSlaTimerState(
  due: Date | null | undefined,
  met: boolean,
  resolved: boolean
): SlaTimerState | null {
  if (!due) return null;
  if (met || resolved) {
    return { label: "Met", variant: "met", msRemaining: 0 };
  }

  const ms = due.getTime() - Date.now();
  if (ms <= 0) {
    const overdue = formatDuration(Math.abs(ms));
    return { label: `Overdue ${overdue}`, variant: "overdue", msRemaining: ms };
  }

  const remaining = formatDuration(ms);
  const variant = ms < 60 * 60 * 1000 ? "warning" : "ok";
  return { label: `${remaining} left`, variant, msRemaining: ms };
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 48) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}
