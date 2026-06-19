import { TEAM_DEPARTMENTS } from "@/lib/team";

export const DEFAULT_CHAT_CHANNELS = [
  { slug: "general", name: "General", type: "PUBLIC" as const, description: "Company-wide announcements and discussion" },
  ...TEAM_DEPARTMENTS.map((dept) => ({
    slug: dept.toLowerCase().replace(/\s+/g, "-"),
    name: dept,
    type: "DEPARTMENT" as const,
    department: dept,
    description: `${dept} team channel`,
  })),
];

export function dmChannelSlug(userIdA: string, userIdB: string) {
  const [a, b] = [userIdA, userIdB].sort();
  return `dm-${a}-${b}`;
}

export function dmChannelName(
  currentUserId: string,
  members: { userId: string; username: string; displayName: string | null }[]
) {
  const other = members.find((m) => m.userId !== currentUserId);
  return other?.displayName ?? other?.username ?? "Direct message";
}
