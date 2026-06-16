"use server";

import { revalidatePath } from "next/cache";
import { ok, requireActionPermission } from "@/lib/action-utils";
import { logPlatformError } from "@/lib/platform-log";
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
    revalidatePath("/admin/media");
    revalidatePath("/", "layout");
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
