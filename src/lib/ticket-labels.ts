import { TicketCategory, TicketPriority, TicketStatus } from "@prisma/client";

export const TICKET_CATEGORY_LABELS: Record<TicketCategory, string> = {
  GENERAL_SUPPORT: "General Support",
  TECHNICAL_SUPPORT: "Technical Support",
  BILLING: "Billing",
  PREMIUM_ACCESS: "Premium Support",
  CREATOR_SUPPORT: "Creator Support",
  PARTNER_SUPPORT: "Partner Support",
  BUG_REPORT: "Bug Report",
  CUSTOM_ORDERS: "Custom Orders",
  MOD_ISSUES: "Mod Issues",
  ACCOUNT_SUPPORT: "Account Support",
};

export const TICKET_DEPARTMENTS: TicketCategory[] = [
  "GENERAL_SUPPORT",
  "TECHNICAL_SUPPORT",
  "BILLING",
  "PREMIUM_ACCESS",
  "CREATOR_SUPPORT",
  "PARTNER_SUPPORT",
  "CUSTOM_ORDERS",
];

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  WAITING_FOR_USER: "Waiting for User",
  WAITING_FOR_STAFF: "Waiting for Staff",
  ESCALATED: "Escalated",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
  URGENT: "Urgent",
  CRITICAL: "Critical",
};

export const ROLE_LABELS: Record<string, string> = {
  OWNER: "OWNER",
  ADMIN: "Admin",
  MODERATOR: "Moderator",
  SUPPORT: "Support",
  PARTNER: "Partner",
  CREATOR: "Creator",
  DESIGNER: "Designer",
  PREMIUM: "Premium",
  USER: "User",
};
