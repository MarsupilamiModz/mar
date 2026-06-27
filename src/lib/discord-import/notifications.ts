import "server-only";

import type { DiscordImportType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { notifyUser } from "@/lib/notifications-service";

export async function notifyDiscordImportStaff(params: {
  entryId: string;
  title: string;
  importType: DiscordImportType;
  success: boolean;
  error?: string;
}) {
  const staff = await prisma.user.findMany({
    where: {
      deletedAt: null,
      isBanned: false,
      role: { in: ["OWNER", "ADMIN", "MODERATOR"] },
    },
    select: { id: true },
  });

  const title = params.success
    ? `New Discord import: ${params.title}`
    : `Discord import failed: ${params.title}`;

  const body = params.success
    ? `${params.importType} draft ready for review`
    : params.error ?? "Unknown error";

  await Promise.all(
    staff.map((s) =>
      notifyUser({
        userId: s.id,
        type: "SYSTEM",
        category: "discord-import",
        title,
        body,
        link: `/en/owner/discord-import?tab=queue&entry=${params.entryId}`,
        metadata: { entryId: params.entryId, importType: params.importType },
      })
    )
  );
}

export async function notifyDiscordImportReviewed(params: {
  entryId: string;
  title: string;
  approved: boolean;
  authorUserId?: string | null;
}) {
  if (!params.authorUserId) return;
  await notifyUser({
    userId: params.authorUserId,
    type: "SYSTEM",
    category: "discord-import",
    title: params.approved ? "Import approved" : "Import rejected",
    body: params.title,
    link: `/en/dashboard`,
    metadata: { entryId: params.entryId },
  });
}

export async function notifyDiscordVirusDetected(params: {
  entryId: string;
  title: string;
  fileName: string;
}) {
  const staff = await prisma.user.findMany({
    where: { role: { in: ["OWNER", "ADMIN"] }, deletedAt: null },
    select: { id: true },
  });
  await Promise.all(
    staff.map((s) =>
      notifyUser({
        userId: s.id,
        type: "SYSTEM",
        category: "discord-import",
        title: "Virus scan alert on Discord import",
        body: `${params.title} — ${params.fileName}`,
        link: `/en/owner/discord-import?tab=queue&entry=${params.entryId}`,
      })
    )
  );
}
