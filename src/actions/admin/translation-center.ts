"use server";

import { revalidatePath } from "next/cache";
import { ok, requireActionOwner } from "@/lib/action-utils";
import { auditTranslationKeys } from "@/lib/i18n-audit";
import { clearTranslationCache, getTranslationCacheStats } from "@/lib/translation-cache";
import {
  getTranslationQueueStats,
  processPendingTranslationJobs,
  retranslateAllPendingMods,
} from "@/lib/translation-worker";
import { getMissingTranslationReport, syncMissingUiKeysFromEnglish } from "@/lib/translation-missing-keys";

export async function getOwnerTranslationCenter() {
  const { error } = await requireActionOwner();
  if (error) return error;

  const [queue, cache, missing, audit] = await Promise.all([
    getTranslationQueueStats(),
    getTranslationCacheStats(),
    getMissingTranslationReport(),
    Promise.resolve(auditTranslationKeys("en")),
  ]);

  return ok({ queue, cache, missing, audit });
}

export async function ownerProcessTranslationQueue() {
  const { error } = await requireActionOwner();
  if (error) return error;
  const processed = await processPendingTranslationJobs(50);
  revalidatePath("/admin/owner/translations");
  return ok({ processed });
}

export async function ownerClearTranslationCache() {
  const { error } = await requireActionOwner();
  if (error) return error;
  const cleared = await clearTranslationCache();
  revalidatePath("/admin/owner/translations");
  return ok({ cleared });
}

export async function ownerRetranslateAllMods() {
  const { error } = await requireActionOwner();
  if (error) return error;
  const queued = await retranslateAllPendingMods(100);
  revalidatePath("/admin/owner/translations");
  return ok({ queued });
}

export async function ownerSyncMissingUiKeys() {
  const { error } = await requireActionOwner();
  if (error) return error;
  const result = await syncMissingUiKeysFromEnglish();
  revalidatePath("/admin/localization");
  revalidatePath("/admin/owner/translations");
  return ok(result);
}
