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
