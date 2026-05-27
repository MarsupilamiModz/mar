import { createHmac, timingSafeEqual } from "crypto";
import { ModPricing, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSignedDownloadUrl } from "@/lib/r2";
import { userHasModLicense } from "@/lib/secure-download";
import { userHasMembershipAccess } from "@/lib/membership";

export async function canDownloadMod(
  userId: string | null,
  mod: {
    id: string;
    pricing: ModPricing;
    authorId: string;
    priceCents: number | null;
  },
  user?: { role: UserRole; subscriptions: { status: string }[] } | null
) {
  if (mod.pricing === "FREE") return true;
  if (!userId || !user) return false;
  if (["OWNER", "ADMIN"].includes(user.role)) return true;
  if (mod.authorId === userId) return true;

  if (mod.pricing === "PREMIUM") {
    const hasPremium =
      ["OWNER", "ADMIN"].includes(user.role) ||
      (await userHasMembershipAccess(userId, user.role));
    if (hasPremium) return true;
    return userHasModLicense(userId, mod.id);
  }

  if (mod.pricing === "PAID") {
    const purchase = await prisma.modPurchase.findUnique({
      where: { modId_userId: { modId: mod.id, userId } },
    });
    if (purchase) return true;
    return userHasModLicense(userId, mod.id);
  }

  return false;
}

export function signDownloadToken(payload: {
  modId: string;
  versionId: string;
  userId: string;
  exp: number;
}) {
  const secret = process.env.DOWNLOAD_SIGNING_SECRET!;
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyDownloadToken(token: string) {
  const secret = process.env.DOWNLOAD_SIGNING_SECRET!;
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;

  const expected = createHmac("sha256", secret).update(data).digest("base64url");
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }

  const payload = JSON.parse(Buffer.from(data, "base64url").toString());
  if (payload.exp < Date.now()) return null;
  return payload as { modId: string; versionId: string; userId: string; exp: number };
}

export async function createSecureDownload(
  modId: string,
  versionId: string,
  userId: string,
  fileKey: string
) {
  const exp = Date.now() + 5 * 60 * 1000;
  const token = signDownloadToken({ modId, versionId, userId, exp });
  const url = await getSignedDownloadUrl(fileKey, 300);
  return { url, token };
}
