"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { ok, requireActionPermission } from "@/lib/action-utils";
import { logPlatformError } from "@/lib/platform-log";
import { CACHE_TAGS } from "@/lib/cache";
import { locales } from "@/i18n/config";
import {
  runFullMediaRepair,
  scanMissingMediaFiles,
  repairModMediaUrls,
  repairUserAvatars,
  repairSoundPreviews,
} from "@/lib/media-repair";

export async function adminScanMissingMedia() {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;
  return ok(await scanMissingMediaFiles());
}

export async function adminRepairAllMedia() {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;
  try {
    const result = await runFullMediaRepair();
    revalidateTag(CACHE_TAGS.mods);
    revalidateTag(CACHE_TAGS.creators);
    revalidateTag(CACHE_TAGS.partners);
    revalidateTag(CACHE_TAGS.games);
    revalidatePath("/", "layout");
    for (const locale of locales) {
      revalidatePath(`/${locale}/admin/media`);
      revalidatePath(`/${locale}/admin/diagnostics/screenshots`);
      revalidatePath(`/${locale}/creators`);
      revalidatePath(`/${locale}/partners`);
      revalidatePath(`/${locale}/team`);
    }
    return ok(result);
  } catch (err) {
    await logPlatformError("admin/media-repair", err);
    throw err;
  }
}

export async function adminRepairModScreenshots() {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;
  const result = await repairModMediaUrls();
  revalidatePath("/admin/media");
  return ok(result);
}

export async function adminRepairAvatars() {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;
  const result = await repairUserAvatars();
  revalidatePath("/admin/media");
  revalidatePath("/", "layout");
  return ok(result);
}

export async function adminRepairSoundPreviews() {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;
  const result = await repairSoundPreviews();
  revalidatePath("/admin/media");
  return ok(result);
}

export async function logAdminClientError(input: {
  context: string;
  message: string;
  route?: string;
  digest?: string;
}) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;
  await logPlatformError(
    input.context,
    new Error(
      [input.message, input.route && `route=${input.route}`, input.digest && `digest=${input.digest}`]
        .filter(Boolean)
        .join(" | ")
    )
  );
  return ok(undefined);
}
