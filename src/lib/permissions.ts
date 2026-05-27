import { UserRole } from "@prisma/client";

export const PERMISSIONS = {
  "users.read": "View users",
  "users.write": "Manage users",
  "mods.read": "View all mods",
  "mods.write": "Manage mods",
  "mods.moderate": "Moderate mods",
  "assets.write": "Upload design assets",
  "assets.read": "View own assets",
  "games.write": "Manage games",
  "analytics.read": "View analytics",
  "analytics.creator": "View creator analytics",
  "subscriptions.read": "View subscriptions",
  "coupons.write": "Manage coupons",
  "licenses.write": "Manage license keys",
  "orders.read": "View custom orders",
  "orders.write": "Manage custom orders",
  "tickets.read": "View support tickets",
  "tickets.write": "Manage support tickets",
  "audit.read": "View audit logs",
  "settings.write": "Manage site settings",
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

const ROLE_PERMISSIONS: Record<UserRole, PermissionKey[]> = {
  OWNER: Object.keys(PERMISSIONS) as PermissionKey[],
  ADMIN: [
    "users.read",
    "users.write",
    "mods.read",
    "mods.write",
    "mods.moderate",
    "assets.write",
    "games.write",
    "analytics.read",
    "analytics.creator",
    "subscriptions.read",
    "coupons.write",
    "licenses.write",
    "orders.read",
    "orders.write",
    "tickets.read",
    "tickets.write",
    "audit.read",
    "settings.write",
  ],
  MODERATOR: ["mods.read", "mods.moderate", "tickets.read", "tickets.write"],
  SUPPORT: ["tickets.read", "tickets.write", "orders.read"],
  CREATOR: ["mods.read", "assets.read", "analytics.creator", "licenses.write"],
  PARTNER: ["analytics.creator", "coupons.write"],
  DESIGNER: ["mods.read", "assets.read", "assets.write", "orders.read", "orders.write", "analytics.creator"],
  PREMIUM: [],
  USER: [],
};

export function hasPermission(role: UserRole, permission: PermissionKey) {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function isStaff(role: UserRole) {
  return ["OWNER", "ADMIN", "MODERATOR", "SUPPORT"].includes(role);
}

export function isAdmin(role: UserRole) {
  return ["OWNER", "ADMIN"].includes(role);
}

export function isCreator(role: UserRole) {
  return role === "CREATOR" || role === "OWNER" || role === "ADMIN";
}

export function isPartner(role: UserRole) {
  return role === "PARTNER" || role === "OWNER" || role === "ADMIN";
}

export function isCreatorOrPartner(role: UserRole) {
  return isCreator(role) || isPartner(role);
}

export function isDesigner(role: UserRole) {
  return role === "DESIGNER" || role === "OWNER" || role === "ADMIN";
}

export function isPublisher(role: UserRole) {
  return isCreator(role) || isDesigner(role);
}

export function canAccessStudio(role: UserRole) {
  return isPublisher(role) || isPartner(role) || hasPermission(role, "mods.write");
}
