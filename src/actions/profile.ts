"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, requireActionUser } from "@/lib/action-utils";
import { sendAuthVerificationEmail } from "@/lib/auth-verification-email";
import { isValidEmail, normalizeEmail } from "@/lib/email/address";
import { logPlatformError } from "@/lib/platform-log";
import { rateLimit } from "@/lib/rate-limit";
import { validateUploadFile } from "@/lib/upload-validation";
import { slugify } from "@/lib/utils";
import { persistUserAvatarFromBuffer, verifyAvatarStorage } from "@/lib/avatar-persist";
import { bustAvatarUrl } from "@/lib/avatar-url";

const profileSchema = z.object({
  displayName: z.string().min(1).max(80).optional(),
  bio: z.string().max(500).optional(),
  locale: z.enum(["en", "de", "fr", "es", "tr", "pl"]).optional(),
});

export async function updateProfile(input: z.infer<typeof profileSchema>) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.message);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      displayName: parsed.data.displayName,
      bio: parsed.data.bio,
      locale: parsed.data.locale,
    },
  });

  revalidatePath("/dashboard/settings");
  return ok(undefined);
}

export async function uploadAvatar(formData: FormData) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  try {
    const file = formData.get("avatar") as File;
    const validation = validateUploadFile(file, {
      maxSizeMb: 20,
      allowedTypes: [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "image/avif",
        "image/svg+xml",
      ],
      label: "Avatar",
    });
    if (!validation.valid) return fail(validation.error);

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await persistUserAvatarFromBuffer(user.id, buffer, validation.mime);
    const verify = await verifyAvatarStorage(user.id);
    if (!verify.ok) return fail(verify.detail);

    revalidatePath("/dashboard/settings");
    return ok({ url: bustAvatarUrl(result.displayUrl) ?? result.displayUrl ?? "" });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Avatar upload failed");
  }
}

export async function applyForCreator(tagline?: string) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  if (user.creatorProfile) return fail("Already a creator");

  const slug = slugify(user.username);
  let uniqueSlug = slug;
  let i = 0;
  while (await prisma.creatorProfile.findUnique({ where: { slug: uniqueSlug } })) {
    uniqueSlug = `${slug}${++i}`;
  }

  await prisma.$transaction([
    prisma.creatorProfile.create({
      data: { userId: user.id, slug: uniqueSlug, tagline },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { role: user.role === "USER" ? "CREATOR" : user.role },
    }),
  ]);

  revalidatePath("/dashboard");
  return ok({ slug: uniqueSlug });
}

export async function requestPasswordReset(email: string, locale = "en") {
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) {
    return ok(undefined);
  }

  const ip = headers().get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = rateLimit(`password-reset:${ip}`, 5, 60 * 60 * 1000);
  if (!rl.success) return ok(undefined);

  const user = await prisma.user.findFirst({
    where: { email: normalized, deletedAt: null },
    select: { id: true, username: true, displayName: true },
  });

  if (!user) return ok(undefined);

  try {
    await sendAuthVerificationEmail({
      email: normalized,
      username: user.displayName ?? user.username,
      locale,
      type: "recovery",
      userId: user.id,
    });
  } catch (err) {
    void logPlatformError("auth:password-reset", err);
  }

  return ok(undefined);
}

export async function updatePassword(password: string) {
  const { error: authError } = await requireActionUser();
  if (authError) return authError;

  if (password.length < 8) return fail("Password must be at least 8 characters");

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return fail(error.message);
  return ok(undefined);
}
