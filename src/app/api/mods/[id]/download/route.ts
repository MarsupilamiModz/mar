import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canDownloadMod } from "@/lib/downloads";
import { getSignedDownloadUrl } from "@/lib/r2";
import { issueSecureDownloadToken } from "@/lib/secure-download";
import { evaluateUserAchievements } from "@/lib/achievements";
import { rateLimit } from "@/lib/rate-limit";
import { checkMissingDependencies } from "@/lib/mod-dependencies";
import { createHash } from "crypto";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const ipHash = createHash("sha256").update(ip).digest("hex").slice(0, 16);

  const { searchParams } = new URL(req.url);
  const versionId = searchParams.get("versionId");
  const skipDeps = searchParams.get("skipDeps") === "1";

  const limit = rateLimit(`dl:${params.id}:${ipHash}`, 10, 60_000);
  if (!limit.success) return NextResponse.json({ error: "Rate limited" }, { status: 429 });

  const mod = await prisma.mod.findUnique({
    where: { id: params.id },
    include: {
      versions: versionId
        ? { where: { id: versionId, isArchived: false }, take: 1 }
        : { where: { isPrimary: true, isArchived: false }, take: 1 },
    },
  });

  if (!mod || !mod.versions[0]) {
    return NextResponse.json({ error: "Mod not found" }, { status: 404 });
  }

  const version = mod.versions[0];
  const blockedScanStatuses = ["MALWARE", "SUSPICIOUS", "MANUAL_REVIEW", "FAILED", "PENDING"];
  if (blockedScanStatuses.includes(version.scanStatus)) {
    return NextResponse.json({ error: "File pending security review" }, { status: 403 });
  }

  if (!skipDeps) {
    const depCheck = await checkMissingDependencies(mod.id, user?.id ?? null);
    if (depCheck.missing.length > 0) {
      return NextResponse.json(
        {
          error: "Missing dependencies",
          missing: depCheck.missing.map((d) => ({
            id: d.dependency.id,
            slug: d.dependency.slug,
            title: d.dependency.title,
            minVersion: d.minVersion,
          })),
        },
        { status: 409 }
      );
    }
  }

  const allowed = await canDownloadMod(
    user?.id ?? null,
    mod,
    user ? { role: user.role, subscriptions: user.subscriptions ?? [] } : null
  );

  if (!allowed) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  if (mod.pricing !== "FREE" && !user) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  const { url, token } = await (async () => {
    const signedUrl = await getSignedDownloadUrl(version.fileKey, 300);
    const issued = await issueSecureDownloadToken({
      modId: mod.id,
      versionId: version.id,
      userId: user?.id ?? "anonymous",
      ipHash,
      userAgent: req.headers.get("user-agent")?.slice(0, 200),
    });
    return { url: signedUrl, token: issued.token };
  })();

  await prisma.download.create({
    data: {
      modId: mod.id,
      versionId: version.id,
      userId: user?.id,
      ipHash,
      userAgent: req.headers.get("user-agent")?.slice(0, 200),
    },
  });

  await prisma.$transaction([
    prisma.mod.update({
      where: { id: mod.id },
      data: { downloadCount: { increment: 1 } },
    }),
    prisma.modVersion.update({
      where: { id: version.id },
      data: { downloadCount: { increment: 1 } },
    }),
  ]);

  if (user?.id) {
    void evaluateUserAchievements(user.id);
  }

  return NextResponse.json({ url, token, versionId: version.id });
}
