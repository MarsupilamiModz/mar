import { ROLE_LABELS } from "@/lib/ticket-labels";

/** Display label for admin UI — Owner role is always shown as OWNER. */
export function formatRoleLabel(role: string): string {
  if (role === "OWNER") return "OWNER";
  return ROLE_LABELS[role] ?? role;
}

export function isOwnerRole(role: string): boolean {
  return role === "OWNER";
}

export function roleBadgeVariant(role: string): "premium" | "destructive" | "outline" {
  if (role === "OWNER") return "premium";
  if (role === "ADMIN") return "premium";
  if (role === "MODERATOR") return "outline";
  return "outline";
}

export function formatGroupLabel(name: string, slug?: string): string {
  if (slug === "owner" || /^owner$/i.test(name)) return "OWNER";
  return name;
}

export const ROLE_HIERARCHY_LABEL = "USER → PREMIUM → PARTNER → CREATOR → DESIGNER → SUPPORT → MODERATOR → ADMIN → OWNER";
