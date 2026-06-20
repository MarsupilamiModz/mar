import type { TeamRoleGroup } from "@prisma/client";

export const TEAM_ROLE_GROUPS: Array<{
  key: TeamRoleGroup;
  title: string;
  defaultColor: string;
}> = [
  { key: "OWNER", title: "OWNER", defaultColor: "#f59e0b" },
  { key: "ADMINISTRATOR", title: "ADMINISTRATORS", defaultColor: "#ef4444" },
  { key: "MANAGER", title: "MANAGERS", defaultColor: "#6366f1" },
  { key: "SUPPORT", title: "SUPPORT", defaultColor: "#22c55e" },
  { key: "MODERATOR", title: "MODERATORS", defaultColor: "#a855f7" },
  { key: "DESIGNER", title: "DESIGNERS", defaultColor: "#ec4899" },
  { key: "CREATOR", title: "CREATORS", defaultColor: "#06b6d4" },
] as const;

export function teamRoleTitle(group: TeamRoleGroup) {
  return TEAM_ROLE_GROUPS.find((entry) => entry.key === group)?.title ?? group;
}

export function teamRoleColor(group: TeamRoleGroup, override?: string | null) {
  return override || TEAM_ROLE_GROUPS.find((entry) => entry.key === group)?.defaultColor || "#a855f7";
}
