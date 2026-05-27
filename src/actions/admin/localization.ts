"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, requireActionPermission } from "@/lib/action-utils";
import {
  approveTranslation,
  getPendingTranslations,
  processTranslationJob,
  translateModContent,
} from "@/lib/localization";

export async function getAdminTranslations() {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;
  return ok(await getPendingTranslations());
}

export async function runTranslationJob(jobId: string) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;
  const result = await processTranslationJob(jobId);
  if (!result) return fail("Translation failed");
  revalidatePath("/admin/localization");
  return ok(result);
}

export async function approveTranslationJob(jobId: string) {
  const { user, error } = await requireActionPermission("settings.write");
  if (error) return error;
  await approveTranslation(jobId, user.id);
  revalidatePath("/admin/localization");
  return ok(undefined);
}

export async function queueModTranslations(modId: string, sourceLocale = "en") {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;
  const jobs = await translateModContent(modId, sourceLocale);
  revalidatePath("/admin/localization");
  return ok({ queued: jobs.length });
}
