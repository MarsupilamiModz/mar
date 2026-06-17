import { UserRole } from "@prisma/client";

export const PERMISSIONS = {
  "users.read": "View users",
  "users.write": "Manage users",
  "mods.read": "View all mods",
  "mods.write": "Manage mods",
  "mods.moderate": "Moderate mods",
  "mods.download": "Download mods",
  "mods.comment": "Comment on mods",
  "mods.review": "Review mods",
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
  "orders.view": "View orders",
  "orders.manage": "Manage orders",
  "orders.assign": "Assign orders",
  "orders.complete": "Complete orders",
  "custom_orders.view": "View custom service orders",
  "custom_orders.manage": "Manage custom service orders",
  "custom_orders.chat": "Chat on custom orders",
  "shop.view": "View shop admin",
  "shop.create": "Create shop products",
  "shop.edit": "Edit shop products",
  "shop.delete": "Delete shop products",
  "tickets.read": "View support tickets",
  "tickets.write": "Manage support tickets",
  "audit.read": "View audit logs",
  "settings.write": "Manage site settings",
  "creator.upload": "Upload mods",
  "creator.manage": "Manage creator page",
  "partner.analytics": "View partner analytics",
  "partner.referral": "Manage referral links",
  "moderation.comments": "Moderate comments",
  "moderation.reports": "Manage reports",
  "support.tickets": "Manage tickets",
  "support.tools": "Access support tools",
  "manager.creators": "Manage creators",
  "manager.partners": "Manage partners",
  "manager.content": "Manage content",
  "designer.branding": "Manage branding",
  "designer.banners": "Manage banners",
  "designer.assets": "Manage design assets",
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

/** Default role → permission map (used when DB has no overrides for a role). */
export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, PermissionKey[]> = {
  OWNER: Object.keys(PERMISSIONS) as PermissionKey[],
  ADMIN: [
    "users.read",
    "users.write",
    "mods.read",
    "mods.write",
    "mods.moderate",
    "mods.download",
    "mods.comment",
    "mods.review",
    "assets.write",
    "games.write",
    "analytics.read",
    "analytics.creator",
    "subscriptions.read",
    "coupons.write",
    "licenses.write",
    "orders.read",
    "orders.write",
    "orders.view",
    "orders.manage",
    "orders.assign",
    "orders.complete",
    "custom_orders.view",
    "custom_orders.manage",
    "custom_orders.chat",
    "shop.view",
    "shop.create",
    "shop.edit",
    "shop.delete",
    "tickets.read",
    "tickets.write",
    "support.tickets",
    "support.tools",
    "manager.creators",
    "manager.partners",
    "manager.content",
    "designer.branding",
    "designer.banners",
    "designer.assets",
    "audit.read",
    "settings.write",
  ],
  MODERATOR: ["mods.read", "mods.moderate", "mods.comment", "moderation.comments", "moderation.reports", "tickets.read", "tickets.write", "support.tickets"],
  SUPPORT: ["tickets.read", "tickets.write", "support.tickets", "support.tools", "orders.read", "orders.view", "custom_orders.view"],
  CREATOR: ["mods.read", "mods.download", "mods.comment", "creator.upload", "creator.manage", "assets.read", "analytics.creator", "licenses.write"],
  PARTNER: ["analytics.creator", "partner.analytics", "partner.referral", "coupons.write"],
  DESIGNER: [
    "mods.read",
    "assets.read",
    "assets.write",
    "designer.branding",
    "designer.banners",
    "designer.assets",
    "orders.read",
    "orders.write",
    "orders.view",
    "orders.assign",
    "orders.complete",
    "custom_orders.view",
    "custom_orders.manage",
    "custom_orders.chat",
    "analytics.creator",
  ],
  PREMIUM: ["mods.read", "mods.download", "mods.comment"],
  USER: ["mods.read", "mods.download", "mods.comment"],
};

/** Lower → higher. Higher roles inherit all permissions from lower tiers. */
export const ROLE_HIERARCHY: UserRole[] = [
  "USER",
  "PREMIUM",
  "PARTNER",
  "CREATOR",
  "DESIGNER",
  "SUPPORT",
  "MODERATOR",
  "ADMIN",
  "OWNER",
];

export function hasPermission(role: UserRole, permission: PermissionKey) {
  const idx = ROLE_HIERARCHY.indexOf(role);
  if (idx < 0) return DEFAULT_ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
  for (let i = 0; i <= idx; i++) {
    const perms = DEFAULT_ROLE_PERMISSIONS[ROLE_HIERARCHY[i]] ?? [];
    if (perms.includes(permission)) return true;
  }
  return false;
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
