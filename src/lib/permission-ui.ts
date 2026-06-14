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
    id: "dashboard",
    label: "Dashboard access",
    description: "Control which areas of the platform are reachable",
    keys: ["analytics.read", "analytics.creator", "settings.write"],
  },
  {
    id: "users",
    label: "Users & accounts",
    keys: ["users.read", "users.write"],
  },
  {
    id: "mods",
    label: "Mods & uploads",
    keys: ["mods.read", "mods.write", "mods.moderate", "assets.read", "assets.write"],
  },
  {
    id: "games",
    label: "Games & catalog",
    keys: ["games.write"],
  },
  {
    id: "support",
    label: "Tickets & orders",
    keys: ["tickets.read", "tickets.write", "orders.read", "orders.write"],
  },
  {
    id: "creators",
    label: "Creators & partners",
    keys: ["users.read", "users.write", "coupons.write", "analytics.creator"],
  },
  {
    id: "commerce",
    label: "Billing & licenses",
    keys: ["subscriptions.read", "licenses.write", "coupons.write"],
  },
  {
    id: "platform",
    label: "Platform & security",
    keys: ["settings.write", "audit.read"],
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
