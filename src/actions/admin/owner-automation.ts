"use server";

import { ok, fail, requireActionUser } from "@/lib/action-utils";
import {
  getDiscordAutomationSettings,
  saveDiscordAutomationSettings,
  sendDiscordEmbed,
  getMediaTemplateSettings,
  saveMediaTemplateSettings,
  type DiscordAutomationSettings,
  type MediaTemplateSettings,
} from "@/lib/discord-automation";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";

async function requireOwnerAction() {
  const { user, error } = await requireActionUser();
  if (error) return { user: null as never, error };
  if (user.role !== "OWNER") return { user: null as never, error: fail("Owner access only") };
  return { user, error: null };
}

export async function getOwnerAutomationData() {
  const { error } = await requireOwnerAction();
  if (error) return error;

  const [discord, mediaTemplates, auditLogs] = await Promise.all([
    getDiscordAutomationSettings(),
    getMediaTemplateSettings(),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        metadata: true,
        ipHash: true,
        createdAt: true,
        actor: { select: { username: true, displayName: true } },
      },
    }),
  ]);

  return ok({ discord, mediaTemplates, auditLogs });
}

export async function saveDiscordAutomation(input: DiscordAutomationSettings) {
  const { user, error } = await requireOwnerAction();
  if (error) return error;

  const result = await saveDiscordAutomationSettings(input);
  if (!result.ok) return fail(result.error);

  await createAuditLog({
    actorId: user.id,
    action: "owner.discord_automation.update",
    entityType: "SiteSetting",
    entityId: "discord_automation",
  });

  return ok(undefined);
}

export async function saveMediaTemplates(input: MediaTemplateSettings) {
  const { user, error } = await requireOwnerAction();
  if (error) return error;

  const result = await saveMediaTemplateSettings(input);
  if (!result.ok) return fail(result.error);

  await createAuditLog({
    actorId: user.id,
    action: "owner.media_templates.update",
    entityType: "SiteSetting",
    entityId: "media_templates",
  });

  return ok(undefined);
}

export async function testDiscordWebhook(channelId?: string) {
  const { user, error } = await requireOwnerAction();
  if (error) return error;

  const result = await sendDiscordEmbed(
    {
      title: "Webhook test",
      description: `Test message from ${user.username} via Owner Panel`,
      color: 0x6366f1,
    },
    channelId as never
  );

  if (!result.ok) return fail(result.error);
  return ok(undefined);
}
