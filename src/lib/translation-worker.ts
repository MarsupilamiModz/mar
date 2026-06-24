import { prisma } from "@/lib/db";
import { enqueueBackgroundJob } from "@/lib/background-jobs";
import {
  applyApprovedTranslation,
  queueTranslation,
  processTranslationJob,
} from "@/lib/localization";
import { CONTENT_TARGET_LOCALES } from "@/lib/content-translator";
import { detectSourceLocale } from "@/lib/translation-service";
import { getTranslationEngineStatus } from "@/lib/translation-service";

const AUTO_APPROVE = process.env.TRANSLATION_REQUIRE_APPROVAL !== "true";

async function runJobPipeline(jobId: string) {
  const processed = await processTranslationJob(jobId);
  if (!processed || processed.status !== "COMPLETED") return processed;
  if (AUTO_APPROVE) {
    await applyApprovedTranslation(processed);
    await prisma.translationJob.update({
      where: { id: processed.id },
      data: { status: "APPROVED", approvedAt: new Date() },
    });
  }
  return processed;
}

/** Queue + background-process translations for one entity field across all target locales. */
export async function scheduleEntityTranslation(input: {
  entityType: string;
  entityId: string;
  fields: Record<string, string | null | undefined>;
  sourceLocale?: string;
  approverId?: string;
  targetLocales?: string[];
}) {
  const targets = input.targetLocales ?? CONTENT_TARGET_LOCALES;
  const jobs: string[] = [];

  for (const [field, value] of Object.entries(input.fields)) {
    const text = value?.trim();
    if (!text) continue;
    const sourceLocale = input.sourceLocale ?? detectSourceLocale(text);

    for (const targetLocale of targets) {
      if (targetLocale === sourceLocale) continue;
      const job = await queueTranslation({
        entityType: input.entityType,
        entityId: input.entityId,
        field,
        sourceLocale,
        targetLocale,
        sourceText: text,
      });
      jobs.push(job.id);
    }
  }

  if (jobs.length === 0) return { queued: 0 };

  enqueueBackgroundJob(async () => {
    for (const jobId of jobs) {
      try {
        await runJobPipeline(jobId);
      } catch (err) {
        console.error("[translation-worker]", jobId, err);
      }
    }
  });

  return { queued: jobs.length };
}

export async function processPendingTranslationJobs(limit = 25) {
  const pending = await prisma.translationJob.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });

  let processed = 0;
  for (const job of pending) {
    const result = await processTranslationJob(job.id);
    if (result?.status === "COMPLETED" && AUTO_APPROVE) {
      await applyApprovedTranslation(result);
      await prisma.translationJob.update({
        where: { id: job.id },
        data: { status: "APPROVED", approvedAt: new Date() },
      });
    }
    if (result) processed++;
  }
  return processed;
}

export async function getTranslationQueueStats() {
  const [pending, processing, completed, failed, approved] = await Promise.all([
    prisma.translationJob.count({ where: { status: "PENDING" } }),
    prisma.translationJob.count({ where: { status: "PROCESSING" } }),
    prisma.translationJob.count({ where: { status: "COMPLETED" } }),
    prisma.translationJob.count({ where: { status: "FAILED" } }),
    prisma.translationJob.count({ where: { status: "APPROVED" } }),
  ]);

  return {
    pending,
    processing,
    completed,
    failed,
    approved,
    engine: getTranslationEngineStatus(),
  };
}

export async function retranslateAllPendingMods(limit = 50) {
  const mods = await prisma.mod.findMany({
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: { id: true, title: true, description: true, shortDescription: true },
  });

  let queued = 0;
  for (const mod of mods) {
    const result = await scheduleEntityTranslation({
      entityType: "Mod",
      entityId: mod.id,
      fields: {
        title: mod.title,
        description: mod.description,
        shortDescription: mod.shortDescription,
      },
    });
    queued += result.queued;
  }
  return queued;
}
