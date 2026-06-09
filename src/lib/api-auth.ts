import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

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
