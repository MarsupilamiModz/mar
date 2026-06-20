"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { ok, requireActionPermission } from "@/lib/action-utils";
import { CACHE_TAGS } from "@/lib/cache";
import { diagnoseModScreenshots } from "@/lib/media-diagnostics";
import { repairModMediaUrls } from "@/lib/media-repair";
import { locales } from "@/i18n/config";

export async function getScreenshotDiagnostics(limit = 100) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;
  return ok(await diagnoseModScreenshots(limit));
}

export async function repairScreenshotLinks() {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  const result = await repairModMediaUrls();

  revalidateTag(CACHE_TAGS.mods);
  for (const locale of locales) {
    revalidatePath(`/${locale}/admin/diagnostics/screenshots`);
    revalidatePath(`/${locale}/admin/media`);
  }

  return ok(result);
}
