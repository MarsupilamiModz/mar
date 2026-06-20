"use server";

import { revalidatePath } from "next/cache";
import { ChatChannelType, type Prisma } from "@prisma/client";
import { z } from "zod";
import { fail, ok, requireActionUser } from "@/lib/action-utils";
import { DEFAULT_CHAT_CHANNELS, dmChannelName, dmChannelSlug } from "@/lib/chat-constants";
import { parseMentionUsernames } from "@/lib/chat-mentions";
import { prisma } from "@/lib/db";
import { notifyChatMention } from "@/lib/notifications-service";
import { getEffectivePermissions } from "@/lib/permission-store";
import {
  canAccessTeamChat,
  canAccessTeamChatChannel,
  channelSortValue,
  type TeamChatUserLike,
} from "@/lib/team-chat-access";

const attachmentSchema = z.object({
  url: z.string().url(),
  key: z.string().min(1).max(500),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(120),
  fileSize: z.number().int().positive().max(50 * 1024 * 1024),
});

const sendSchema = z
  .object({
    channelId: z.string().min(1),
    content: z.string().max(8000).default(""),
    replyToId: z.string().optional(),
    attachments: z.array(attachmentSchema).max(8).default([]),
  })
  .refine((value) => value.content.trim().length > 0 || value.attachments.length > 0, {
    message: "Message cannot be empty",
  });

type TeamChatActor = TeamChatUserLike & {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
};

type ChannelWithMembership = Prisma.ChatChannelGetPayload<{
  include: { members: { where: { userId: string } } };
}>;

async function ensureDefaultChannels() {
  for (const ch of DEFAULT_CHAT_CHANNELS) {
    await prisma.chatChannel.upsert({
      where: { slug: ch.slug },
      create: {
        slug: ch.slug,
        name: ch.name,
        description: ch.description,
        type: ch.type,
        department: ch.department,
      },
      update: {
        name: ch.name,
        description: ch.description,
        type: ch.type,
        department: ch.department,
      },
    });
  }
}

async function requireTeamChatUser() {
  const { user, error } = await requireActionUser();
  if (error) return { user: null as never, permissions: new Set<string>(), error };

  const permissions = await getEffectivePermissions({
    id: user.id,
    role: user.role,
    permissionGroupId: user.permissionGroupId,
  });

  if (!canAccessTeamChat(user, permissions)) {
    return { user: null as never, permissions, error: fail("Forbidden") };
  }

  return { user: user as TeamChatActor, permissions, error: null };
}

async function canAccessChannel(
  user: TeamChatActor,
  permissions: Set<string>,
  channelId: string
): Promise<ChannelWithMembership | null> {
  const channel = await prisma.chatChannel.findUnique({
    where: { id: channelId },
    include: { members: { where: { userId: user.id } } },
  });
  if (!channel || channel.isArchived) return null;
  if (channel.type === "DM") {
    return channel.members.length > 0 ? channel : null;
  }
  return canAccessTeamChatChannel(user, permissions, channel) ? channel : null;
}

async function ensureMembership(user: TeamChatActor, permissions: Set<string>, channelId: string) {
  const channel = await canAccessChannel(user, permissions, channelId);
  if (!channel) return null;
  if (channel.type === "DM") return channel;

  await prisma.chatChannelMember.upsert({
    where: { channelId_userId: { channelId, userId: user.id } },
    create: { channelId, userId: user.id },
    update: {},
  });
  return channel;
}

async function resolveChannelName(userId: string, channel: { id: string; name: string; type: ChatChannelType }) {
  if (channel.type !== "DM") return channel.name;
  const members = await prisma.chatChannelMember.findMany({
    where: { channelId: channel.id },
    include: { user: { select: { id: true, username: true, displayName: true } } },
  });
  return dmChannelName(
    userId,
    members.map((m) => ({
      userId: m.userId,
      username: m.user.username,
      displayName: m.user.displayName,
    }))
  );
}

async function listEligibleTeammates(currentUserId: string) {
  const candidates = await prisma.user.findMany({
    where: { deletedAt: null, id: { not: currentUserId } },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      role: true,
      permissionGroupId: true,
      teamDepartment: true,
      designerProfile: { select: { id: true } },
    },
    orderBy: [{ role: "asc" }, { username: "asc" }],
    take: 200,
  });

  const rows = await Promise.all(
    candidates.map(async (candidate) => {
      const permissions = await getEffectivePermissions({
        id: candidate.id,
        role: candidate.role,
        permissionGroupId: candidate.permissionGroupId,
      });
      return canAccessTeamChat(candidate, permissions) ? candidate : null;
    })
  );

  return rows
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .map((row) => ({
      id: row.id,
      username: row.username,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
      role: row.role,
      teamDepartment: row.teamDepartment,
    }));
}

function touchChatPaths() {
  revalidatePath("/team-chat");
  revalidatePath("/admin/chat");
}

export async function listChatChannelsForUser() {
  const { user, permissions, error } = await requireTeamChatUser();
  if (error) return error;

  await ensureDefaultChannels();

  const allChannels = await prisma.chatChannel.findMany({
    where: {
      isArchived: false,
      OR: [{ type: { in: ["PUBLIC", "DEPARTMENT"] } }, { members: { some: { userId: user.id } } }],
    },
    include: {
      members: {
        where: { userId: user.id },
        select: { lastReadAt: true },
      },
      messages: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true, content: true, senderId: true, attachments: true },
      },
      _count: { select: { members: true } },
    },
  });

  const channels = allChannels
    .filter((channel) => {
      if (channel.type === "DM") return true;
      return canAccessTeamChatChannel(user, permissions, channel);
    })
    .sort((a, b) => channelSortValue(a) - channelSortValue(b) || a.name.localeCompare(b.name));

  const teammates = await listEligibleTeammates(user.id);

  const rows = await Promise.all(
    channels.map(async (channel) => {
      const membership = channel.members[0];
      const lastMessage = channel.messages[0];
      let unread = 0;
      if (lastMessage && lastMessage.senderId !== user.id) {
        const since = membership?.lastReadAt ?? new Date(0);
        unread = await prisma.chatMessage.count({
          where: {
            channelId: channel.id,
            createdAt: { gt: since },
            senderId: { not: user.id },
            deletedAt: null,
          },
        });
      }

      const displayName = await resolveChannelName(user.id, channel);
      const hasAttachments = Array.isArray(lastMessage?.attachments) && lastMessage.attachments.length > 0;

      return {
        id: channel.id,
        slug: channel.slug,
        name: displayName,
        type: channel.type,
        department: channel.department,
        description: channel.description,
        unread,
        lastMessage: lastMessage
          ? {
              content: lastMessage.content.slice(0, 120) || (hasAttachments ? "Attachment" : ""),
              createdAt: lastMessage.createdAt,
            }
          : null,
        memberCount: channel._count.members,
      };
    })
  );

  return ok({ channels: rows, teammates });
}

export async function getChatMessages(channelId: string, params?: { before?: string; limit?: number }) {
  const { user, permissions, error } = await requireTeamChatUser();
  if (error) return error;

  const channel = await ensureMembership(user, permissions, channelId);
  if (!channel) return fail("Channel not found");

  const limit = Math.min(params?.limit ?? 50, 100);
  const messages = await prisma.chatMessage.findMany({
    where: {
      channelId,
      deletedAt: null,
      ...(params?.before ? { createdAt: { lt: new Date(params.before) } } : {}),
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

  await prisma.chatChannelMember.upsert({
    where: { channelId_userId: { channelId, userId: user.id } },
    create: { channelId, userId: user.id, lastReadAt: new Date() },
    update: { lastReadAt: new Date() },
  });

  const participants = await prisma.chatChannelMember.findMany({
    where: { channelId },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          role: true,
        },
      },
    },
    orderBy: { joinedAt: "asc" },
  });

  const channelName = await resolveChannelName(user.id, channel);

  touchChatPaths();
  return ok({
    messages: messages.reverse().map((message) => ({
      ...message,
      attachments: Array.isArray(message.attachments) ? message.attachments : [],
    })),
    channel: {
      id: channel.id,
      slug: channel.slug,
      name: channelName,
      type: channel.type,
      description: channel.description,
    },
    participants: participants.map((member) => ({
      id: member.user.id,
      username: member.user.username,
      displayName: member.user.displayName,
      avatarUrl: member.user.avatarUrl,
      role: member.user.role,
      lastReadAt: member.lastReadAt,
    })),
  });
}

export async function sendChatMessage(input: z.infer<typeof sendSchema>) {
  const { user, permissions, error } = await requireTeamChatUser();
  if (error) return error;

  const parsed = sendSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid message");

  const channel = await ensureMembership(user, permissions, parsed.data.channelId);
  if (!channel) return fail("Channel not found");

  const attachments = parsed.data.attachments.map((attachment) => ({
    url: attachment.url,
    key: attachment.key,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    fileSize: attachment.fileSize,
  }));

  const message = await prisma.chatMessage.create({
    data: {
      channelId: parsed.data.channelId,
      senderId: user.id,
      content: parsed.data.content.trim(),
      replyToId: parsed.data.replyToId,
      attachments,
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

  await prisma.chatChannelMember.upsert({
    where: { channelId_userId: { channelId: parsed.data.channelId, userId: user.id } },
    create: { channelId: parsed.data.channelId, userId: user.id, lastReadAt: new Date() },
    update: { lastReadAt: new Date() },
  });

  const mentions = parseMentionUsernames(parsed.data.content);
  const channelLabel = await resolveChannelName(user.id, channel);

  if (mentions.length > 0) {
    const mentioned = await prisma.user.findMany({
      where: {
        username: { in: mentions },
        deletedAt: null,
      },
      select: {
        id: true,
        username: true,
        role: true,
        permissionGroupId: true,
        teamDepartment: true,
        designerProfile: { select: { id: true } },
      },
    });

    for (const mentionedUser of mentioned) {
      if (mentionedUser.id === user.id) continue;
      const mentionedPerms = await getEffectivePermissions({
        id: mentionedUser.id,
        role: mentionedUser.role,
        permissionGroupId: mentionedUser.permissionGroupId,
      });
      if (!canAccessTeamChat(mentionedUser, mentionedPerms)) continue;
      void notifyChatMention({
        userId: mentionedUser.id,
        channelId: channel.id,
        channelName: channelLabel,
        senderName: user.displayName ?? user.username,
        preview: parsed.data.content.slice(0, 160),
      });
    }
  }

  touchChatPaths();
  return ok({
    message: {
      ...message,
      attachments,
    },
  });
}

export async function getOrCreateDmChannel(otherUserId: string) {
  const { user, error } = await requireTeamChatUser();
  if (error) return error;
  if (otherUserId === user.id) return fail("Cannot DM yourself");

  const other = await prisma.user.findFirst({
    where: { id: otherUserId, deletedAt: null },
    select: {
      id: true,
      role: true,
      permissionGroupId: true,
      teamDepartment: true,
      designerProfile: { select: { id: true } },
    },
  });
  if (!other) return fail("Teammate not found");

  const otherPermissions = await getEffectivePermissions({
    id: other.id,
    role: other.role,
    permissionGroupId: other.permissionGroupId,
  });
  if (!canAccessTeamChat(other, otherPermissions)) return fail("Teammate not found");

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

  touchChatPaths();
  return ok({ channelId: channel.id, slug: channel.slug });
}

export async function markChatChannelRead(channelId: string) {
  const { user, permissions, error } = await requireTeamChatUser();
  if (error) return error;

  const channel = await canAccessChannel(user, permissions, channelId);
  if (!channel) return fail("Channel not found");

  await prisma.chatChannelMember.upsert({
    where: { channelId_userId: { channelId, userId: user.id } },
    create: { channelId, userId: user.id, lastReadAt: new Date() },
    update: { lastReadAt: new Date() },
  });

  return ok(undefined);
}
