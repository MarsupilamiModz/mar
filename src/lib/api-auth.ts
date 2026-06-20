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
  | "downloads:meta";

export const API_SCOPES: ApiScope[] = [
  "mods:read",
  "games:read",
  "creators:read",
  "collections:read",
  "downloads:meta",
];

export function generateApiKey(): { raw: string; prefix: string; hash: string } {
  const raw = `xm_${randomBytes(32).toString("hex")}`;
  const prefix = raw.slice(0, 12);
  const hash = createHash("sha256").update(raw).digest("hex");
  return { raw, prefix, hash };
}

export async function validateApiKey(
  authHeader: string | null
): Promise<{ ok: true; keyId: string; scopes: string[]; rateLimit: number } | { ok: false; status: number; error: string }> {
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "Missing Bearer token" };
  }

  const raw = authHeader.slice(7).trim();
  const hash = createHash("sha256").update(raw).digest("hex");

  const key = await prisma.apiKey.findUnique({ where: { keyHash: hash } });
  if (!key || !key.isActive) {
    return { ok: false, status: 401, error: "Invalid API key" };
  }
  if (key.expiresAt && key.expiresAt < new Date()) {
    return { ok: false, status: 401, error: "API key expired" };
  }

  const limit = rateLimit(`api:${key.id}`, key.rateLimit, 60_000);
  if (!limit.success) {
    return { ok: false, status: 429, error: "Rate limit exceeded" };
  }

  void prisma.apiKey.update({
    where: { id: key.id },
    data: { lastUsedAt: new Date() },
  });

  return { ok: true, keyId: key.id, scopes: key.scopes, rateLimit: key.rateLimit };
}

export function hasScope(scopes: string[], required: ApiScope): boolean {
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

/** Reject off-site open redirects — only same-origin relative paths allowed. */
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
