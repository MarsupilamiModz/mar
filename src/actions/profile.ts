"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, requireActionUser } from "@/lib/action-utils";
import { uploadAsset } from "@/lib/asset-storage";
import { extensionForMime, validateUploadFile } from "@/lib/upload-validation";
import { slugify } from "@/lib/utils";
import { revalidateProfileMedia } from "@/lib/media-revalidate";
import { getMediaUrl } from "@/lib/media-url";

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
      maxSizeMb: 2,
      allowedTypes: ["image/jpeg", "image/png", "image/webp"],
      label: "Avatar",
    });
    if (!validation.valid) return fail(validation.error);

    const buffer = Buffer.from(await file.arrayBuffer());
    const relativePath = `${user.id}/${Date.now()}.${extensionForMime(validation.mime)}`;
    const result = await uploadAsset({
      bucket: "creator-avatars",
      relativePath,
      body: buffer,
      contentType: validation.mime,
    });

    await prisma.user.update({
      where: { id: user.id },
      data: {
        avatarUrl: result.url,
        avatar256Url: result.url,
        avatar128Url: result.url,
        avatar64Url: result.url,
        avatarOriginalUrl: result.url,
      },
    });

    await revalidateProfileMedia(user.id);
    revalidatePath("/dashboard/settings");
    return ok({ url: getMediaUrl(result.url) });
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

export async function requestPasswordReset(email: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/en/reset-password`,
  });
  if (error) return fail(error.message);
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
