import type { Prisma, TicketStatus } from "@prisma/client";

export type TicketQueue =
  | "all"
  | "open"
  | "pending"
  | "escalated"
  | "unassigned"
  | "mine"
  | "waiting_user"
  | "solved"
  | "closed";

export const OPEN_STATUSES: TicketStatus[] = [
  "NEW",
  "OPEN",
  "PENDING",
  "IN_PROGRESS",
  "WAITING_FOR_USER",
  "WAITING_FOR_STAFF",
  "ESCALATED",
];

export const TICKET_QUEUE_LABELS: Record<TicketQueue, string> = {
  all: "All",
  open: "Open",
  pending: "Pending",
  escalated: "Escalated",
  unassigned: "Unassigned",
  mine: "My tickets",
  waiting_user: "Waiting user",
  solved: "Solved",
  closed: "Closed",
};

export function queueWhere(
  queue: TicketQueue,
  currentUserId?: string
): Prisma.SupportTicketWhereInput {
  switch (queue) {
    case "open":
      return { status: { in: ["NEW", "OPEN", "IN_PROGRESS"] } };
    case "pending":
      return { status: "PENDING" };
    case "escalated":
      return { status: "ESCALATED" };
    case "unassigned":
      return { assigneeId: null, status: { in: OPEN_STATUSES } };
    case "mine":
      return currentUserId
        ? { assigneeId: currentUserId, status: { in: OPEN_STATUSES } }
        : { id: "__none__" };
    case "waiting_user":
      return { status: "WAITING_FOR_USER" };
    case "solved":
      return { status: { in: ["RESOLVED", "CLOSED"] } };
    case "closed":
      return { status: "CLOSED" };
    default:
      return {};
  }
}
