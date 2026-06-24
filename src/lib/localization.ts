import { prisma } from "@/lib/db";
import { getSiteSetting, setSiteSetting } from "@/lib/site-settings";
import type { TranslationJob, Prisma } from "@prisma/client";
import { translateText } from "@/lib/translation-service";
import { CONTENT_TARGET_LOCALES } from "@/lib/content-translator";
import { locales } from "@/i18n/config";

export const SUPPORTED_LOCALES = locales;

export type SupportedLocale = (typeof locales)[number];

export type EntityTranslationStore = Record<
  string,
  Record<string, Record<string, string>>
>;

const TRANSLATIONS_KEY = "entity_translations";

export async function getEntityTranslations(): Promise<EntityTranslationStore> {
  return getSiteSetting(TRANSLATIONS_KEY, {} as EntityTranslationStore);
}

async function persistModTranslation(
  modId: string,
  locale: string,
  field: string,
  value: string
) {
  const mod = await prisma.mod.findUnique({ where: { id: modId }, select: { translations: true } });
  if (!mod) return;
  const translations = (mod.translations as Record<string, Record<string, string>> | null) ?? {};
  if (!translations[locale]) translations[locale] = {};
  translations[locale][field] = value;
  await prisma.mod.update({
    where: { id: modId },
    data: { translations: translations as Prisma.InputJsonValue },
  });
}

export async function applyApprovedTranslation(job: TranslationJob) {
  if (!job.translatedText) return;

  const store = await getEntityTranslations();
  const entityKey = `${job.entityType}:${job.entityId}`;
  if (!store[entityKey]) store[entityKey] = {};
  if (!store[entityKey][job.targetLocale]) store[entityKey][job.targetLocale] = {};
  store[entityKey][job.targetLocale][job.field] = job.translatedText;
  await setSiteSetting(TRANSLATIONS_KEY, store);

  if (job.entityType === "Mod") {
    await persistModTranslation(job.entityId, job.targetLocale, job.field, job.translatedText);
  }

  if (job.entityType === "MembershipPlan") {
    const plan = await prisma.membershipPlan.findUnique({ where: { id: job.entityId } });
    if (plan) {
      const translations = (plan.translations as Record<string, Record<string, string>> | null) ?? {};
      if (!translations[job.targetLocale]) translations[job.targetLocale] = {};
      translations[job.targetLocale][job.field] = job.translatedText;
      await prisma.membershipPlan.update({
        where: { id: job.entityId },
        data: { translations: translations as Prisma.InputJsonValue },
      });
    }
  }
}

export async function getLocalizedField(
  entityType: string,
  entityId: string,
  locale: string,
  field: string,
  fallback: string
) {
  if (locale === "en") return fallback;

  if (entityType === "Mod") {
    const mod = await prisma.mod.findUnique({
      where: { id: entityId },
      select: { translations: true },
    });
    const fromMod = (mod?.translations as Record<string, Record<string, string>> | null)?.[locale]?.[field];
    if (fromMod) return fromMod;
  }

  const store = await getEntityTranslations();
  return (
    store[`${entityType}:${entityId}`]?.[locale]?.[field] ??
    store[`${entityType}:${entityId}`]?.["en"]?.[field] ??
    fallback
  );
}

export async function getLocalizedModContent(
  modId: string,
  locale: string,
  fields: { title: string; description: string; shortDescription?: string | null }
) {
  const [title, description, shortDescription] = await Promise.all([
    getLocalizedField("Mod", modId, locale, "title", fields.title),
    getLocalizedField("Mod", modId, locale, "description", fields.description),
    fields.shortDescription
      ? getLocalizedField("Mod", modId, locale, "shortDescription", fields.shortDescription)
      : Promise.resolve(null),
  ]);
  return { title, description, shortDescription };
}

export function isSupportedLocale(locale: string): locale is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(locale);
}

export async function queueTranslation(params: {
  entityType: string;
  entityId: string;
  field: string;
  sourceLocale: string;
  targetLocale: string;
  sourceText: string;
}) {
  const existing = await prisma.translationJob.findFirst({
    where: {
      entityType: params.entityType,
      entityId: params.entityId,
      field: params.field,
      targetLocale: params.targetLocale,
      status: { in: ["PENDING", "PROCESSING", "COMPLETED", "APPROVED"] },
    },
  });

  if (existing) {
    if (existing.sourceText === params.sourceText) return existing;
    await prisma.translationJob.update({
      where: { id: existing.id },
      data: { status: "FAILED", error: "Superseded by updated source text" },
    });
  }

  return prisma.translationJob.create({
    data: { ...params, status: "PENDING" },
  });
}

export async function processTranslationJob(jobId: string) {
  const job = await prisma.translationJob.findUnique({ where: { id: jobId } });
  if (!job || job.status !== "PENDING") return job;

  await prisma.translationJob.update({
    where: { id: jobId },
    data: { status: "PROCESSING" },
  });

  try {
    const result = await translateText({
      text: job.sourceText,
      sourceLocale: job.sourceLocale,
      targetLocale: job.targetLocale,
      field: job.field,
      entityType: job.entityType,
    });

    if (result.provider === "fallback" && result.text === job.sourceText && job.targetLocale !== job.sourceLocale) {
      throw new Error("No translation provider configured");
    }

    return prisma.translationJob.update({
      where: { id: jobId },
      data: { status: "COMPLETED", translatedText: result.text },
    });
  } catch (err) {
    await prisma.translationJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        error: err instanceof Error ? err.message : "Translation failed",
      },
    });
    return null;
  }
}

export async function approveTranslation(jobId: string, approverId: string) {
  const job = await prisma.translationJob.update({
    where: { id: jobId },
    data: { status: "APPROVED", approvedById: approverId, approvedAt: new Date() },
  });
  await applyApprovedTranslation(job);
  return job;
}

export async function getPendingTranslations(limit = 50) {
  return prisma.translationJob.findMany({
    where: { status: { in: ["PENDING", "COMPLETED"] } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function translateModContent(modId: string, sourceLocale?: string) {
  const mod = await prisma.mod.findUnique({ where: { id: modId } });
  if (!mod) return [];

  const { scheduleEntityTranslation } = await import("@/lib/translation-worker");
  await scheduleEntityTranslation({
    entityType: "Mod",
    entityId: modId,
    sourceLocale,
    fields: {
      title: mod.title,
      description: mod.description,
      shortDescription: mod.shortDescription,
    },
  });

  return prisma.translationJob.findMany({
    where: { entityType: "Mod", entityId: modId, status: "PENDING" },
    take: CONTENT_TARGET_LOCALES.length * 3,
  });
}

export { CONTENT_TARGET_LOCALES };
