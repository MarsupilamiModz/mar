import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { isAdmin, type PermissionKey } from "@/lib/permissions";
import { userHasPermission } from "@/lib/permission-store";

export type ApiScope =
  | "mods:read"
  | "games:read"
  | "creators:read"
  | "collections:read"
  | "downloads:meta"
  | "upload:write"
  | "files:read";

export const API_SCOPES: ApiScope[] = [
  "mods:read",
  "games:read",
  "creators:read",
  "collections:read",
  "downloads:meta",
  "upload:write",
  "files:read",
];

export const API_KEY_PRESETS: Record<
  string,
  { label: string; scopes: ApiScope[]; rateLimit: number }
> = {
  upload: { label: "Upload API", scopes: ["upload:write"], rateLimit: 1000 },
  download: { label: "Download API", scopes: ["downloads:meta", "mods:read", "files:read"], rateLimit: 5000 },
  readonly: {
    label: "Read only",
    scopes: ["mods:read", "games:read", "creators:read", "collections:read", "downloads:meta"],
    rateLimit: 10000,
  },
  full: { label: "Full access", scopes: [], rateLimit: 10000 },
};

export function resolvePresetScopes(preset: keyof typeof API_KEY_PRESETS): string[] {
  if (preset === "full") return ["*"];
  return API_KEY_PRESETS[preset].scopes;
}

export function generateApiKey(): { raw: string; prefix: string; hash: string } {
  const raw = `xm_${randomBytes(32).toString("hex")}`;
  const prefix = raw.slice(0, 12);
  const hash = createHash("sha256").update(raw).digest("hex");
  return { raw, prefix, hash };
}

export type ApiKeyAuth = {
  keyId: string;
  scopes: string[];
  rateLimit: number;
  createdById: string;
};

export function extractApiKeyFromRequest(req: Request): string | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  const headerKey = req.headers.get("x-api-key")?.trim();
  if (headerKey) return headerKey;
  return null;
}

export function getClientIpFromRequest(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip")?.trim() ??
    "unknown"
  );
}

function ipAllowed(clientIp: string, whitelist: string[]): boolean {
  if (!whitelist.length) return true;
  return whitelist.some((entry) => entry.trim() === clientIp || entry.trim() === "*");
}

export async function validateApiKeyFromRequest(
  req: Request
): Promise<{ ok: true; auth: ApiKeyAuth } | { ok: false; status: number; error: string; keyId?: string }> {
  const raw = extractApiKeyFromRequest(req);
  if (!raw) {
    return { ok: false, status: 401, error: "Missing API key (Authorization: Bearer xm_… or x-api-key header)" };
  }
  return validateApiKeyRaw(raw, getClientIpFromRequest(req), req.headers.get("user-agent") ?? undefined);
}

/** @deprecated Use validateApiKeyFromRequest */
export async function validateApiKey(authHeader: string | null) {
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false as const, status: 401, error: "Missing Bearer token" };
  }
  const result = await validateApiKeyRaw(authHeader.slice(7).trim());
  if (!result.ok) return result;
  return {
    ok: true as const,
    keyId: result.auth.keyId,
    scopes: result.auth.scopes,
    rateLimit: result.auth.rateLimit,
  };
}

export async function validateApiKeyRaw(
  raw: string,
  clientIp?: string,
  userAgent?: string
): Promise<{ ok: true; auth: ApiKeyAuth } | { ok: false; status: number; error: string; keyId?: string }> {
  const hash = createHash("sha256").update(raw).digest("hex");

  const key = await prisma.apiKey.findUnique({ where: { keyHash: hash } });
  if (!key || !key.isActive) {
    return { ok: false, status: 401, error: "Invalid API key" };
  }
  if (key.expiresAt && key.expiresAt < new Date()) {
    await recordApiKeyUsage(key.id, { error: true, action: "auth.expired", ip: clientIp, userAgent });
    return { ok: false, status: 401, error: "API key expired", keyId: key.id };
  }

  if (clientIp && !ipAllowed(clientIp, key.ipWhitelist)) {
    await recordApiKeyUsage(key.id, { error: true, action: "auth.ip_denied", ip: clientIp, userAgent });
    return { ok: false, status: 403, error: "IP not allowed for this API key", keyId: key.id };
  }

  const limit = rateLimit(`api:${key.id}`, key.rateLimit, 60_000);
  if (!limit.success) {
    await recordApiKeyUsage(key.id, { error: true, action: "auth.rate_limit", ip: clientIp, userAgent });
    return { ok: false, status: 429, error: "Rate limit exceeded", keyId: key.id };
  }

  void recordApiKeyUsage(key.id, { action: "auth.success", ip: clientIp, userAgent });

  return {
    ok: true,
    auth: {
      keyId: key.id,
      scopes: key.scopes,
      rateLimit: key.rateLimit,
      createdById: key.createdById,
    },
  };
}

export async function recordApiKeyUsage(
  keyId: string,
  opts: {
    error?: boolean;
    upload?: boolean;
    bytes?: number;
    action?: string;
    ip?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
  } = {}
) {
  const { error, upload, bytes = 0, action, ip, userAgent, metadata } = opts;

  await prisma.apiKey.update({
    where: { id: keyId },
    data: {
      lastUsedAt: new Date(),
      requestCount: { increment: 1 },
      ...(error ? { errorCount: { increment: 1 } } : {}),
      ...(upload ? { uploadCount: { increment: 1 }, uploadBytes: { increment: bytes } } : {}),
    },
  });

  if (action) {
    void prisma.auditLog
      .create({
        data: {
          action,
          entityType: "ApiKey",
          entityId: keyId,
          ipHash: ip ? createHash("sha256").update(ip).digest("hex").slice(0, 32) : undefined,
          metadata: {
            ...(userAgent ? { userAgent } : {}),
            ...(metadata ?? {}),
          },
        },
      })
      .catch(() => undefined);
  }
}

export function hasScope(scopes: string[], required: ApiScope | "*"): boolean {
  return scopes.includes(required) || scopes.includes("*");
}

type ApiUser = {
  id: string;
  role: Parameters<typeof userHasPermission>[0]["role"];
  permissionGroupId?: string | null;
};

export async function apiUserHasPermission(
  user: ApiUser,
  permission: PermissionKey
): Promise<boolean> {
  if (user.role === "OWNER") return true;
  return userHasPermission(
    { id: user.id, role: user.role, permissionGroupId: user.permissionGroupId },
    permission
  );
}

export function safeSameOriginPath(path: string | null | undefined, fallback = "/"): string {
  if (!path?.trim()) return fallback;
  const normalized = path.trim();
  if (!normalized.startsWith("/") || normalized.startsWith("//")) return fallback;
  if (normalized.includes("/login") || normalized.includes("/register")) return fallback;
  return normalized;
}

export async function canManageCollection(
  user: ApiUser,
  collection: { ownerId: string }
): Promise<boolean> {
  if (collection.ownerId === user.id) return true;
  return isAdmin(user.role);
}

export async function assertCollectionCoverAccess(
  user: ApiUser,
  collectionId: string
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const collection = await prisma.modCollection.findUnique({
    where: { id: collectionId },
    select: { ownerId: true },
  });
  if (!collection) {
    return { ok: false, status: 404, message: "Collection not found" };
  }
  if (!(await canManageCollection(user, collection))) {
    return { ok: false, status: 403, message: "Permission denied for this collection" };
  }
  return { ok: true };
}

export async function userOwnsStripePayment(
  userId: string,
  role: ApiUser["role"],
  paymentIntentId: string
): Promise<boolean> {
  if (isAdmin(role)) return true;

  const [modPurchase, membershipPurchase] = await Promise.all([
    prisma.modPurchase.findFirst({
      where: { stripePaymentId: paymentIntentId, userId },
      select: { id: true },
    }),
    prisma.membershipPurchase.findFirst({
      where: { stripePaymentId: paymentIntentId, userId },
      select: { id: true },
    }),
  ]);

  return Boolean(modPurchase || membershipPurchase);
}
