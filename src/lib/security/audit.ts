import type { SecurityAuditAction } from "@prisma/client";
import { prisma } from "@/lib/db";

export type SecurityAuditInput = {
  action: SecurityAuditAction;
  modVersionId?: string;
  modId?: string;
  userId?: string;
  ipHash?: string;
  userAgent?: string;
  deviceInfo?: string;
  metadata?: Record<string, unknown>;
};

export async function logSecurityEvent(input: SecurityAuditInput) {
  try {
    await prisma.securityLog.create({
      data: {
        action: input.action,
        modVersionId: input.modVersionId,
        modId: input.modId,
        userId: input.userId,
        ipHash: input.ipHash,
        userAgent: input.userAgent?.slice(0, 512),
        deviceInfo: input.deviceInfo,
        metadata: input.metadata as object | undefined,
      },
    });
  } catch (err) {
    console.error("[security-audit] failed to log", input.action, err);
  }
}

export async function logSecurityEvents(events: SecurityAuditInput[]) {
  if (events.length === 0) return;
  try {
    await prisma.securityLog.createMany({
      data: events.map((e) => ({
        action: e.action,
        modVersionId: e.modVersionId,
        modId: e.modId,
        userId: e.userId,
        ipHash: e.ipHash,
        userAgent: e.userAgent?.slice(0, 512),
        deviceInfo: e.deviceInfo,
        metadata: e.metadata as object | undefined,
      })),
    });
  } catch (err) {
    console.error("[security-audit] bulk log failed", err);
  }
}
