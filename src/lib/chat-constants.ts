import { TEAM_CHAT_CHANNELS } from "@/lib/team-chat-access";

export const DEFAULT_CHAT_CHANNELS = TEAM_CHAT_CHANNELS;

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
