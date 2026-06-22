import "server-only";
import { prisma } from "@/lib/db";

/** Post a system-style message to a team channel (orders, alerts). */
export async function postTeamChannelAlert(params: {
  channelSlug: string;
  content: string;
}) {
  const channel = await prisma.chatChannel.findFirst({
    where: { slug: params.channelSlug, isArchived: false },
    select: { id: true },
  });
  if (!channel) return;

  const sender = await prisma.user.findFirst({
    where: { role: "OWNER", deletedAt: null, isBanned: false },
    select: { id: true },
  });
  if (!sender) return;

  await prisma.chatMessage.create({
    data: {
      channelId: channel.id,
      senderId: sender.id,
      content: params.content,
    },
  });
}
