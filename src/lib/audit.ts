import "server-only";
import { createHash } from "crypto";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export function getRequestAuditContext() {
  const h = headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded ?? h.get("x-real-ip") ?? "unknown";
  const userAgent = h.get("user-agent") ?? "unknown";
  const ipHash = createHash("sha256").update(ip).digest("hex").slice(0, 32);
  return { ipHash, userAgent, ip };
}

export async function createAuditLog(params: {
  actorId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipHash?: string;
  userAgent?: string;
}) {
  let ipHash = params.ipHash;
  let metadata = params.metadata ?? {};

  if (!ipHash || !params.userAgent) {
    try {
      const ctx = getRequestAuditContext();
      ipHash = ipHash ?? ctx.ipHash;
      metadata = {
        ...metadata,
        ...(params.userAgent ? {} : { userAgent: ctx.userAgent }),
        ...(params.userAgent ? { userAgent: params.userAgent } : {}),
      };
    } catch {
      // headers unavailable outside request context
    }
  } else {
    metadata = { ...metadata, userAgent: params.userAgent };
  }

  return prisma.auditLog.create({
    data: {
      actorId: params.actorId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      metadata: Object.keys(metadata).length ? (metadata as Prisma.InputJsonValue) : undefined,
      ipHash,
    },
  });
}
