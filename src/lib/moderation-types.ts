/** Mirrors Prisma `ModerationAction` — kept local so builds succeed before migrate/generate. */
export const MODERATION_ACTIONS = [
  "BAN_PERMANENT",
  "BAN_TEMPORARY",
  "UNBAN",
  "SUSPEND",
  "UNSUSPEND",
  "MUTE",
  "UNMUTE",
  "WARN",
  "RESET_WARNINGS",
  "SOFT_DELETE",
  "RESTORE",
  "ROLE_CHANGE",
] as const;

export type ModerationAction = (typeof MODERATION_ACTIONS)[number];
