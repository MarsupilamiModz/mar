import type { ChatChannel, ChatChannelType, UserRole } from "@prisma/client";

export const TEAM_CHAT_CHANNELS = [
  {
    slug: "general",
    name: "General",
    type: "PUBLIC" as ChatChannelType,
    description: "Company-wide internal discussion",
    department: null,
  },
  {
    slug: "owner",
    name: "Owner",
    type: "DEPARTMENT" as ChatChannelType,
    description: "Owner-only leadership channel",
    department: "OWNER",
  },
  {
    slug: "admins",
    name: "Admins",
    type: "DEPARTMENT" as ChatChannelType,
    description: "Administration and platform operations",
    department: "ADMINS",
  },
  {
    slug: "managers",
    name: "Managers",
    type: "DEPARTMENT" as ChatChannelType,
    description: "Manager coordination and approvals",
    department: "MANAGERS",
  },
  {
    slug: "support",
    name: "Support",
    type: "DEPARTMENT" as ChatChannelType,
    description: "Support queue and customer issues",
    department: "SUPPORT",
  },
  {
    slug: "moderators",
    name: "Moderators",
    type: "DEPARTMENT" as ChatChannelType,
    description: "Moderation triage and escalations",
    department: "MODERATORS",
  },
  {
    slug: "designers",
    name: "Designers",
    type: "DEPARTMENT" as ChatChannelType,
    description: "Design reviews, assets, and handoff",
    department: "DESIGNERS",
  },
  {
    slug: "developers",
    name: "Developers",
    type: "DEPARTMENT" as ChatChannelType,
    description: "Engineering, releases, and infrastructure",
    department: "DEVELOPERS",
  },
] as const;

export type TeamChatUserLike = {
  id: string;
  role: UserRole;
  teamDepartment?: string | null;
  permissionGroupId?: string | null;
  designerProfile?: { id: string } | null;
};

export function isManagerPermission(permission: string) {
  return permission === "manager.creators" || permission === "manager.partners" || permission === "manager.content";
}

export function canAccessTeamChat(user: TeamChatUserLike, permissions: Set<string>) {
  if (user.role === "OWNER" || user.role === "ADMIN") return true;
  if (permissions.has("*") || permissions.has("team.chat")) return true;
  if (user.role === "SUPPORT" || user.role === "MODERATOR" || user.role === "DESIGNER") return true;
  if (user.designerProfile) return true;
  if (user.teamDepartment?.toLowerCase() === "development") return true;
  return Array.from(permissions).some(isManagerPermission);
}

export function channelSortValue(channel: Pick<ChatChannel, "slug" | "type">) {
  const idx = TEAM_CHAT_CHANNELS.findIndex((item) => item.slug === channel.slug);
  if (idx >= 0) return idx;
  if (channel.type === "DM") return 1000;
  return 500;
}

export function canAccessTeamChatChannel(
  user: TeamChatUserLike,
  permissions: Set<string>,
  channel: Pick<ChatChannel, "type" | "department" | "slug">
) {
  if (channel.type === "PUBLIC") {
    return canAccessTeamChat(user, permissions);
  }

  if (channel.type === "DM") {
    return canAccessTeamChat(user, permissions);
  }

  const audience = (channel.department ?? "").toUpperCase();
  switch (audience) {
    case "OWNER":
      return user.role === "OWNER";
    case "ADMINS":
      return user.role === "OWNER" || user.role === "ADMIN";
    case "MANAGERS":
      return (
        user.role === "OWNER" ||
        user.role === "ADMIN" ||
        Array.from(permissions).some(isManagerPermission)
      );
    case "SUPPORT":
      return user.role === "OWNER" || user.role === "ADMIN" || user.role === "SUPPORT";
    case "MODERATORS":
      return user.role === "OWNER" || user.role === "ADMIN" || user.role === "MODERATOR";
    case "DESIGNERS":
      return (
        user.role === "OWNER" ||
        user.role === "ADMIN" ||
        user.role === "DESIGNER" ||
        Boolean(user.designerProfile)
      );
    case "DEVELOPERS":
      return (
        user.role === "OWNER" ||
        user.role === "ADMIN" ||
        user.teamDepartment?.toLowerCase() === "development"
      );
    default:
      return canAccessTeamChat(user, permissions);
  }
}
