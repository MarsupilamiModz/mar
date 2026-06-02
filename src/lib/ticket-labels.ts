import { TicketCategory, TicketPriority, TicketStatus } from "@prisma/client";

export const TICKET_CATEGORY_LABELS: Record<TicketCategory, string> = {
  BILLING: "Billing",
  PREMIUM_ACCESS: "Premium Access",
  BUG_REPORT: "Bug Report",
  CUSTOM_ORDERS: "Custom Orders",
  MOD_ISSUES: "Mod Issues",
  ACCOUNT_SUPPORT: "Account Support",
};

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  WAITING_FOR_USER: "Waiting for User",
  CLOSED: "Closed",
};

export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
  URGENT: "Urgent",
};

export const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MODERATOR: "Moderator",
  SUPPORT: "Support",
  PARTNER: "Partner",
  CREATOR: "Creator",
  DESIGNER: "Designer",
  PREMIUM: "Premium",
  USER: "User",
};
