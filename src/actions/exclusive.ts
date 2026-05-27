"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { fail, ok, requireActionUser, requireActionPermission } from "@/lib/action-utils";
import { getSignedDownloadUrl } from "@/lib/r2";
import { uploadAsset } from "@/lib/asset-storage";
import type { ExclusiveProgramType, ExclusiveApplicationStatus } from "@prisma/client";
import { hasPermission } from "@/lib/permissions";

export async function createExclusiveProgram(input: {
  modId: string;
  type: ExclusiveProgramType;
  title: string;
  description?: string;
  maxSlots?: number;
  waitlistEnabled?: boolean;
  ndaRequired?: boolean;
  discordRequired?: boolean;
}) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const mod = await prisma.mod.findUnique({ where: { id: input.modId } });
  if (!mod) return fail("Mod not found");
  if (mod.authorId !== user.id && !hasPermission(user.role, "mods.write")) return fail("Forbidden");

  const program = await prisma.exclusiveProgram.create({
    data: {
      modId: input.modId,
      authorId: user.id,
      type: input.type,
      title: input.title,
      description: input.description,
      maxSlots: input.maxSlots,
      waitlistEnabled: input.waitlistEnabled ?? true,
      ndaRequired: input.ndaRequired ?? false,
      discordRequired: input.discordRequired ?? false,
    },
  });

  revalidatePath("/creator/exclusive");
  return ok(program);
}

export async function applyToExclusiveProgram(programId: string, formData: FormData) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const program = await prisma.exclusiveProgram.findUnique({ where: { id: programId } });
  if (!program || !program.isActive) return fail("Program not available");

  if (program.discordRequired && !user.discordId) {
    return fail("Discord account required. Link Discord in settings.");
  }

  const ndaAccepted = formData.get("ndaAccepted") === "true";
  if (program.ndaRequired && !ndaAccepted) return fail("NDA acceptance required");

  const inviteCode = (formData.get("inviteCode") as string)?.trim() || undefined;
  if (inviteCode) {
    const invite = await prisma.exclusiveInviteCode.findUnique({ where: { code: inviteCode } });
    if (!invite || invite.programId !== programId) return fail("Invalid invite code");
    if (invite.maxUses > 0 && invite.uses >= invite.maxUses) return fail("Invite code expired");
    if (invite.expiresAt && invite.expiresAt < new Date()) return fail("Invite code expired");
  }

  const message = (formData.get("message") as string)?.trim();
  const atCapacity = program.maxSlots != null && program.currentCount >= program.maxSlots;
  const status: ExclusiveApplicationStatus =
    inviteCode ? "APPROVED" : atCapacity && program.waitlistEnabled ? "WAITLIST" : atCapacity ? "WAITLIST" : "PENDING";

  const app = await prisma.exclusiveApplication.upsert({
    where: { programId_userId: { programId, userId: user.id } },
    create: {
      programId,
      userId: user.id,
      message,
      ndaAccepted,
      inviteCode,
      status: inviteCode ? "APPROVED" : status,
      reviewedAt: inviteCode ? new Date() : undefined,
    },
    update: { message, ndaAccepted, inviteCode },
  });

  if (inviteCode) {
    await prisma.exclusiveInviteCode.update({
      where: { code: inviteCode },
      data: { uses: { increment: 1 } },
    });
    await prisma.exclusiveProgram.update({
      where: { id: programId },
      data: { currentCount: { increment: 1 } },
    });
  }

  revalidatePath("/creator/exclusive");
  revalidatePath(`/exclusive/${programId}`);
  return ok(app);
}

export async function reviewExclusiveApplication(
  applicationId: string,
  status: ExclusiveApplicationStatus
) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const app = await prisma.exclusiveApplication.findUnique({
    where: { id: applicationId },
    include: { program: true },
  });
  if (!app) return fail("Not found");
  if (app.program.authorId !== user.id && !hasPermission(user.role, "mods.moderate")) {
    return fail("Forbidden");
  }

  const wasApproved = app.status === "APPROVED";
  await prisma.exclusiveApplication.update({
    where: { id: applicationId },
    data: { status, reviewedAt: new Date() },
  });

  if (status === "APPROVED" && !wasApproved) {
    await prisma.exclusiveProgram.update({
      where: { id: app.programId },
      data: { currentCount: { increment: 1 } },
    });
  }

  revalidatePath("/creator/exclusive");
  revalidatePath(`/creator/exclusive/${app.programId}`);
  return ok(undefined);
}

export async function uploadExclusiveBuild(programId: string, formData: FormData) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const program = await prisma.exclusiveProgram.findUnique({ where: { id: programId } });
  if (!program) return fail("Not found");
  if (program.authorId !== user.id && !hasPermission(user.role, "mods.write")) return fail("Forbidden");

  const file = formData.get("file") as File;
  const version = (formData.get("version") as string)?.trim();
  if (!file || !version) return fail("File and version required");

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await uploadAsset({
    bucket: "temp-uploads",
    relativePath: `exclusive/${programId}/${version}/${file.name}`,
    body: buffer,
    contentType: "application/octet-stream",
  });

  const expiresAtRaw = formData.get("expiresAt") as string;
  await prisma.exclusiveBuild.create({
    data: {
      programId,
      version,
      fileKey: result.key,
      fileName: file.name,
      fileSize: file.size,
      expiresAt: expiresAtRaw ? new Date(expiresAtRaw) : null,
    },
  });

  revalidatePath(`/creator/exclusive/${programId}`);
  return ok(undefined);
}

export async function getExclusiveDownloadUrl(buildId: string) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const build = await prisma.exclusiveBuild.findUnique({
    where: { id: buildId },
    include: { program: true },
  });
  if (!build) return fail("Build not found");
  if (build.expiresAt && build.expiresAt < new Date()) return fail("Build expired");

  const approved = await prisma.exclusiveApplication.findFirst({
    where: { programId: build.programId, userId: user.id, status: "APPROVED" },
  });
  const isAuthor = build.program.authorId === user.id;
  const isStaff = hasPermission(user.role, "mods.read");
  if (!approved && !isAuthor && !isStaff) return fail("Access denied");

  const url = await getSignedDownloadUrl(build.fileKey, 300);
  return ok({ url });
}

export async function createExclusiveInviteCode(programId: string, maxUses = 1) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const program = await prisma.exclusiveProgram.findUnique({ where: { id: programId } });
  if (!program) return fail("Not found");
  if (program.authorId !== user.id) return fail("Forbidden");

  const code = `EX-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
  const invite = await prisma.exclusiveInviteCode.create({
    data: { programId, code, maxUses },
  });
  revalidatePath(`/creator/exclusive/${programId}`);
  return ok(invite);
}

export async function getCreatorExclusiveProgram(programId: string) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const program = await prisma.exclusiveProgram.findUnique({
    where: { id: programId },
    include: {
      mod: { select: { title: true, slug: true } },
      builds: { orderBy: { createdAt: "desc" } },
      applications: {
        include: { user: { select: { id: true, username: true, displayName: true, discordId: true } } },
        orderBy: { createdAt: "desc" },
      },
      inviteCodes: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!program) return fail("Not found");
  if (program.authorId !== user.id && !hasPermission(user.role, "mods.read")) return fail("Forbidden");
  return ok(program);
}

export async function getPublicExclusiveProgram(programId: string) {
  const program = await prisma.exclusiveProgram.findUnique({
    where: { id: programId, isActive: true },
    include: {
      mod: { select: { title: true, slug: true, game: { select: { name: true } } } },
      author: { select: { username: true, displayName: true } },
    },
  });
  if (!program) return fail("Program not found");
  return ok(program);
}

export async function getUserExclusiveApplication(programId: string) {
  const { user, error } = await requireActionUser();
  if (error) return error;
  const app = await prisma.exclusiveApplication.findUnique({
    where: { programId_userId: { programId, userId: user.id } },
  });
  return ok(app);
}

export async function toggleExclusiveProgram(programId: string, isActive: boolean) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const program = await prisma.exclusiveProgram.findUnique({ where: { id: programId } });
  if (!program || program.authorId !== user.id) return fail("Forbidden");

  await prisma.exclusiveProgram.update({ where: { id: programId }, data: { isActive } });
  revalidatePath("/creator/exclusive");
  revalidatePath(`/creator/exclusive/${programId}`);
  return ok(undefined);
}

export async function getCreatorModsForExclusive() {
  const { user, error } = await requireActionUser();
  if (error) return error;

  return ok(
    await prisma.mod.findMany({
      where: { authorId: user.id, status: { in: ["PUBLISHED", "DRAFT", "PENDING"] } },
      select: { id: true, title: true, slug: true },
      orderBy: { title: "asc" },
    })
  );
}

export async function getCreatorExclusivePrograms() {
  const { user, error } = await requireActionUser();
  if (error) return error;

  return ok(
    await prisma.exclusiveProgram.findMany({
      where: { authorId: user.id },
      include: {
        mod: { select: { title: true, slug: true } },
        _count: { select: { applications: true, builds: true } },
      },
      orderBy: { createdAt: "desc" },
    })
  );
}

export async function getAdminExclusivePrograms() {
  const { error } = await requireActionPermission("mods.read");
  if (error) return error;

  return ok(
    await prisma.exclusiveProgram.findMany({
      include: {
        mod: { select: { title: true } },
        author: { select: { username: true } },
        _count: { select: { applications: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    })
  );
}
