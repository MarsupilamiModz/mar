import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export async function createAuditLog(params: {
  actorId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipHash?: string;
}) {
  return prisma.auditLog.create({
    data: {
      actorId: params.actorId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      metadata: params.metadata ? (params.metadata as Prisma.InputJsonValue) : undefined,
      ipHash: params.ipHash,
    },
  });
}
