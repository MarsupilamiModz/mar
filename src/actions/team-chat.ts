"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ChatChannelType, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { fail, ok, requireActionPermission } from "@/lib/action-utils";
import { DEFAULT_CHAT_CHANNELS, dmChannelSlug, dmChannelName } from "@/lib/chat-constants";
import { parseMentionUsernames } from "@/lib/chat-mentions";
import { notifyChatMention } from "@/lib/notifications-service";

const STAFF_ROLES: UserRole[] = ["OWNER", "ADMIN", "MODERATOR", "SUPPORT"];

const sendSchema = z.object({
  channelId: z.string().min(1),
  content: z.string().min(1).max(8000),
  replyToId: z.string().optional(),
});

async function ensureDefaultChannels() {
  for (const ch of DEFAULT_CHAT_CHANNELS) {
    await prisma.chatChannel.upsert({
      where: { slug: ch.slug },
      create: {
        slug: ch.slug,
        name: ch.name,
        description: ch.description,
        type: ch.type,
        department: "department" in ch ? ch.department : null,
      },
      update: {},
    });
  }
}

async function canAccessChannel(userId: string, channelId: string) {
  const channel = await prisma.chatChannel.findUnique({
    where: { id: channelId },
    include: { members: { where: { userId } } },
  });
  if (!channel || channel.isArchived) return null;
  if (channel.type === "DM") {
    return channel.members.length > 0 ? channel : null;
  }
  return channel;
}

async function ensureMembership(userId: string, channelId: string) {
  const channel = await canAccessChannel(userId, channelId);
  if (!channel) return null;
  if (channel.type === "DM") return channel;

  await prisma.chatChannelMember.upsert({
    where: { channelId_userId: { channelId, userId } },
    create: { channelId, userId },
    update: {},
  });
  return channel;
}

export async function listChatChannelsForUser() {
  const { user, error } = await requireActionPermission("team.chat");
  if (error) return error;

  await ensureDefaultChannels();

  const channels = await prisma.chatChannel.findMany({
    where: {
      isArchived: false,
      OR: [
        { type: { in: ["PUBLIC", "DEPARTMENT"] } },
        { members: { some: { userId: user.id } } },
      ],
    },
    orderBy: [{ type: "asc" }, { name: "asc" }],
    include: {
      members: {
        where: { userId: user.id },
        select: { lastReadAt: true },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true, content: true, senderId: true },
      },
      _count: { select: { members: true } },
    },
  });

  const staffForDm = await prisma.user.findMany({
    where: { role: { in: STAFF_ROLES }, deletedAt: null, id: { not: user.id } },
    select: { id: true, username: true, displayName: true, avatarUrl: true, role: true },
    orderBy: { username: "asc" },
    take: 100,
  });

  const rows = await Promise.all(
    channels.map(async (ch) => {
      const membership = ch.members[0];
      const lastMessage = ch.messages[0];
      let unread = 0;
      if (lastMessage && lastMessage.senderId !== user.id) {
        const since = membership?.lastReadAt ?? new Date(0);
        unread = await prisma.chatMessage.count({
          where: {
            channelId: ch.id,
            createdAt: { gt: since },
            senderId: { not: user.id },
            deletedAt: null,
          },
        });
      }

      let name = ch.name;
      if (ch.type === "DM") {
        const members = await prisma.chatChannelMember.findMany({
          where: { channelId: ch.id },
          include: { user: { select: { id: true, username: true, displayName: true } } },
        });
        name = dmChannelName(
          user.id,
          members.map((m) => ({
            userId: m.userId,
            username: m.user.username,
            displayName: m.user.displayName,
          }))
        );
      }

      return {
        id: ch.id,
        slug: ch.slug,
        name,
        type: ch.type,
        department: ch.department,
        description: ch.description,
        unread,
        lastMessage: lastMessage
          ? { content: lastMessage.content.slice(0, 120), createdAt: lastMessage.createdAt }
          : null,
        memberCount: ch._count.members,
      };
    })
  );

  return ok({ channels: rows, staff: staffForDm });
}

export async function getChatMessages(channelId: string, params?: { before?: string; limit?: number }) {
  const { user, error } = await requireActionPermission("team.chat");
  if (error) return error;

  const channel = await ensureMembership(user.id, channelId);
  if (!channel) return fail("Channel not found");

  const limit = Math.min(params?.limit ?? 50, 100);
  const messages = await prisma.chatMessage.findMany({
    where: {
      channelId,
      deletedAt: null,
      ...(params?.before && { createdAt: { lt: new Date(params.before) } }),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      sender: {
        select: { id: true, username: true, displayName: true, avatarUrl: true, role: true },
      },
      replyTo: {
        select: {
          id: true,
          content: true,
          sender: { select: { username: true, displayName: true } },
        },
      },
    },
  });

  await prisma.chatChannelMember.updateMany({
    where: { channelId, userId: user.id },
    data: { lastReadAt: new Date() },
  });

  revalidatePath("/admin/chat");
  return ok({ messages: messages.reverse(), channel: { id: channel.id, slug: channel.slug, name: channel.name, type: channel.type } });
}

export async function sendChatMessage(input: z.infer<typeof sendSchema>) {
  const { user, error } = await requireActionPermission("team.chat");
  if (error) return error;

  const parsed = sendSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid message");

  const channel = await ensureMembership(user.id, parsed.data.channelId);
  if (!channel) return fail("Channel not found");

  const message = await prisma.chatMessage.create({
    data: {
      channelId: parsed.data.channelId,
      senderId: user.id,
      content: parsed.data.content.trim(),
      replyToId: parsed.data.replyToId,
    },
    include: {
      sender: {
        select: { id: true, username: true, displayName: true, avatarUrl: true, role: true },
      },
      replyTo: {
        select: {
          id: true,
          content: true,
          sender: { select: { username: true, displayName: true } },
        },
      },
    },
  });

  await prisma.chatChannelMember.updateMany({
    where: { channelId: parsed.data.channelId, userId: user.id },
    data: { lastReadAt: new Date() },
  });

  const mentions = parseMentionUsernames(parsed.data.content);
  if (mentions.length > 0) {
    const mentioned = await prisma.user.findMany({
      where: {
        username: { in: mentions },
        role: { in: STAFF_ROLES },
        deletedAt: null,
      },
      select: { id: true, username: true },
    });
    for (const m of mentioned) {
      if (m.id === user.id) continue;
      void notifyChatMention({
        userId: m.id,
        channelId: channel.id,
        channelName: channel.name,
        senderName: user.displayName ?? user.username,
        preview: parsed.data.content.slice(0, 160),
      });
    }
  }

  revalidatePath("/admin/chat");
  return ok({ message });
}

export async function getOrCreateDmChannel(otherUserId: string) {
  const { user, error } = await requireActionPermission("team.chat");
  if (error) return error;
  if (otherUserId === user.id) return fail("Cannot DM yourself");

  const other = await prisma.user.findFirst({
    where: { id: otherUserId, role: { in: STAFF_ROLES }, deletedAt: null },
  });
  if (!other) return fail("Staff member not found");

  const slug = dmChannelSlug(user.id, otherUserId);
  let channel = await prisma.chatChannel.findUnique({ where: { slug } });

  if (!channel) {
    channel = await prisma.chatChannel.create({
      data: {
        slug,
        name: "Direct message",
        type: ChatChannelType.DM,
        createdById: user.id,
        members: {
          create: [{ userId: user.id }, { userId: otherUserId }],
        },
      },
    });
  } else {
    await prisma.chatChannelMember.upsert({
      where: { channelId_userId: { channelId: channel.id, userId: user.id } },
      create: { channelId: channel.id, userId: user.id },
      update: {},
    });
  }

  revalidatePath("/admin/chat");
  return ok({ channelId: channel.id, slug: channel.slug });
}

export async function markChatChannelRead(channelId: string) {
  const { user, error } = await requireActionPermission("team.chat");
  if (error) return error;

  const channel = await canAccessChannel(user.id, channelId);
  if (!channel) return fail("Channel not found");

  await prisma.chatChannelMember.upsert({
    where: { channelId_userId: { channelId, userId: user.id } },
    create: { channelId, userId: user.id, lastReadAt: new Date() },
    update: { lastReadAt: new Date() },
  });

  return ok(undefined);
}
