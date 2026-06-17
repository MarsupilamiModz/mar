import { PERMISSIONS, type PermissionKey } from "@/lib/permissions";

export type PermissionGroupDef = {
  id: string;
  label: string;
  description?: string;
  keys: PermissionKey[];
};

/** UI grouping for searchable role editor — maps to existing permission keys. */
export const PERMISSION_UI_GROUPS: PermissionGroupDef[] = [
  {
    id: "users",
    label: "Users & accounts",
    keys: ["users.read", "users.write"],
  },
  {
    id: "mods",
    label: "Mods & downloads",
    keys: ["mods.read", "mods.write", "mods.moderate", "mods.download", "mods.comment", "mods.review"],
  },
  {
    id: "creators",
    label: "Creators",
    keys: ["creator.upload", "creator.manage", "assets.read", "assets.write", "analytics.creator", "licenses.write"],
  },
  {
    id: "partners",
    label: "Partners",
    keys: ["partner.analytics", "partner.referral", "coupons.write"],
  },
  {
    id: "moderation",
    label: "Moderation",
    keys: ["moderation.comments", "moderation.reports", "mods.moderate"],
  },
  {
    id: "support",
    label: "Support",
    keys: ["support.tickets", "support.tools", "tickets.read", "tickets.write", "orders.read", "orders.write"],
  },
  {
    id: "management",
    label: "Managers",
    keys: ["manager.creators", "manager.partners", "manager.content"],
  },
  {
    id: "designers",
    label: "Designers",
    keys: ["designer.branding", "designer.banners", "designer.assets"],
  },
  {
    id: "games",
    label: "Games & catalog",
    keys: ["games.write"],
  },
  {
    id: "commerce",
    label: "Shop & billing",
    keys: [
      "shop.view",
      "shop.create",
      "shop.edit",
      "shop.delete",
      "subscriptions.read",
      "licenses.write",
      "coupons.write",
    ],
  },
  {
    id: "orders",
    label: "Custom orders",
    keys: [
      "orders.read",
      "orders.write",
      "orders.view",
      "orders.manage",
      "orders.assign",
      "orders.complete",
      "custom_orders.view",
      "custom_orders.manage",
      "custom_orders.chat",
    ],
  },
  {
    id: "platform",
    label: "Platform & security",
    keys: ["settings.write", "audit.read", "analytics.read"],
  },
];

const groupedKeys = new Set(PERMISSION_UI_GROUPS.flatMap((g) => g.keys));

export const UNGROUPED_PERMISSIONS = (Object.keys(PERMISSIONS) as PermissionKey[]).filter(
  (k) => !groupedKeys.has(k)
);

export function filterPermissionsBySearch(query: string, keys: PermissionKey[]): PermissionKey[] {
  const q = query.trim().toLowerCase();
  if (!q) return keys;
  return keys.filter((k) => {
    const label = PERMISSIONS[k]?.toLowerCase() ?? "";
    return k.toLowerCase().includes(q) || label.includes(q);
  });
}
