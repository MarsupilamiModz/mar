import type { UserRole } from "@prisma/client";

export const ANNOUNCEMENT_TARGETS = [
  { id: "everyone", label: "Everyone" },
  { id: "users", label: "Users" },
  { id: "premium_lite", label: "Premium Lite" },
  { id: "premium", label: "Premium" },
  { id: "premium_max", label: "Premium Max" },
  { id: "creators", label: "Creators" },
  { id: "verified_creators", label: "Verified Creators" },
  { id: "trusted_creators", label: "Trusted Creators" },
  { id: "elite_creators", label: "Elite Creators" },
  { id: "partners", label: "Partners" },
  { id: "official_partners", label: "Official Partners" },
  { id: "moderators", label: "Moderators" },
  { id: "team", label: "Team" },
  { id: "admins", label: "Admins" },
  { id: "custom_groups", label: "Custom Groups" },
] as const;

export type AnnouncementTargetId = (typeof ANNOUNCEMENT_TARGETS)[number]["id"];

export function parseVisibilityTargets(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((v) => typeof v === "string");
  return ["everyone"];
}

type ViewerContext = {
  role: UserRole;
  hasPremium?: boolean;
  hasPremiumLite?: boolean;
  hasPremiumMax?: boolean;
  isCreator?: boolean;
  isVerifiedCreator?: boolean;
  isPartner?: boolean;
  permissionGroupId?: string | null;
};

export function announcementVisibleTo(
  targets: unknown,
  viewer: ViewerContext | null
): boolean {
  const list = parseVisibilityTargets(targets);
  if (list.includes("everyone")) return true;
  if (!viewer) return list.includes("users");

  if (list.includes("users")) return true;
  if (list.includes("admins") && viewer.role === "ADMIN") return true;
  if (list.includes("moderators") && (viewer.role === "MODERATOR" || viewer.role === "ADMIN")) return true;
  if (list.includes("team") && ["ADMIN", "MODERATOR", "SUPPORT"].includes(viewer.role)) return true;
  if (list.includes("creators") && viewer.isCreator) return true;
  if (list.includes("verified_creators") && viewer.isVerifiedCreator) return true;
  if (list.includes("partners") && viewer.isPartner) return true;
  if (list.includes("premium") && viewer.hasPremium) return true;
  if (list.includes("premium_lite") && viewer.hasPremiumLite) return true;
  if (list.includes("premium_max") && viewer.hasPremiumMax) return true;
  if (list.includes("custom_groups") && viewer.permissionGroupId) return true;

  return false;
}
