import { TicketCategory, TicketDepartment, TicketPriority, TicketStatus } from "@prisma/client";

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

export const TICKET_CREATE_CATEGORIES: TicketCategory[] = [
  "GENERAL_SUPPORT",
  "TECHNICAL_SUPPORT",
  "BILLING",
  "PREMIUM_ACCESS",
  "CREATOR_SUPPORT",
  "PARTNER_SUPPORT",
  "BUG_REPORT",
  "CUSTOM_ORDERS",
  "MOD_ISSUES",
  "ACCOUNT_SUPPORT",
];

export const TICKET_DEPARTMENTS: TicketDepartment[] = [
  "SUPPORT",
  "MODERATION",
  "CREATOR_MANAGEMENT",
  "PARTNER_MANAGEMENT",
  "BILLING",
  "TECHNICAL_SUPPORT",
  "ADMINISTRATION",
];

export function categoryToDepartment(category: TicketCategory): TicketDepartment {
  switch (category) {
    case "TECHNICAL_SUPPORT":
    case "BUG_REPORT":
    case "MOD_ISSUES":
      return "TECHNICAL_SUPPORT";
    case "BILLING":
    case "PREMIUM_ACCESS":
      return "BILLING";
    case "CREATOR_SUPPORT":
      return "CREATOR_MANAGEMENT";
    case "PARTNER_SUPPORT":
      return "PARTNER_MANAGEMENT";
    case "ACCOUNT_SUPPORT":
      return "MODERATION";
    default:
      return "SUPPORT";
  }
}

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  NEW: "New",
  OPEN: "Open",
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  WAITING_FOR_USER: "Waiting for User",
  WAITING_FOR_STAFF: "Waiting for Staff",
  ESCALATED: "Escalated",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export const TICKET_DEPARTMENT_LABELS: Record<string, string> = {
  SUPPORT: "Support",
  MODERATION: "Moderation",
  CREATOR_MANAGEMENT: "Creator Management",
  PARTNER_MANAGEMENT: "Partner Management",
  BILLING: "Billing",
  TECHNICAL_SUPPORT: "Technical Support",
  ADMINISTRATION: "Administration",
};

export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = {
  LOW: "Low",
  NORMAL: "Medium",
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
