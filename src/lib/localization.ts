import { prisma } from "@/lib/db";
import { getSiteSetting, setSiteSetting } from "@/lib/site-settings";
import type { TranslationJob, Prisma } from "@prisma/client";

const SUPPORTED_LOCALES = ["en", "de", "fr", "es", "tr", "pl"] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export type EntityTranslationStore = Record<
  string,
  Record<string, Record<string, string>>
>;

const TRANSLATIONS_KEY = "entity_translations";

export async function getEntityTranslations(): Promise<EntityTranslationStore> {
  return getSiteSetting(TRANSLATIONS_KEY, {} as EntityTranslationStore);
}

export async function applyApprovedTranslation(job: TranslationJob) {
  if (!job.translatedText) return;

  const store = await getEntityTranslations();
  const entityKey = `${job.entityType}:${job.entityId}`;
  if (!store[entityKey]) store[entityKey] = {};
  if (!store[entityKey][job.targetLocale]) store[entityKey][job.targetLocale] = {};
  store[entityKey][job.targetLocale][job.field] = job.translatedText;
  await setSiteSetting(TRANSLATIONS_KEY, store);

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

  if (job.entityType === "CreatorProfile" && job.field === "description") {
    await prisma.creatorProfile.update({
      where: { id: job.entityId },
      data: { description: job.translatedText },
    }).catch(() => null);
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
  const store = await getEntityTranslations();
  return store[`${entityType}:${entityId}`]?.[locale]?.[field] ?? fallback;
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
  return SUPPORTED_LOCALES.includes(locale as SupportedLocale);
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
  if (existing) return existing;

  return prisma.translationJob.create({
    data: {
      ...params,
      status: "PENDING",
    },
  });
}

export async function processTranslationJob(jobId: string) {
  const job = await prisma.translationJob.findUnique({ where: { id: jobId } });
  if (!job || job.status !== "PENDING") return job;

  await prisma.translationJob.update({
    where: { id: jobId },
    data: { status: "PROCESSING" },
  });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    await prisma.translationJob.update({
      where: { id: jobId },
      data: { status: "FAILED", error: "OPENAI_API_KEY not configured" },
    });
    return null;
  }

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_TRANSLATION_MODEL ?? "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Translate gaming marketplace content from ${job.sourceLocale} to ${job.targetLocale}. Preserve formatting, mod names, and technical terms. Return only the translation.`,
          },
          { role: "user", content: job.sourceText },
        ],
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(err.slice(0, 500));
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const translated = data.choices?.[0]?.message?.content?.trim();
    if (!translated) throw new Error("Empty translation response");

    return prisma.translationJob.update({
      where: { id: jobId },
      data: { status: "COMPLETED", translatedText: translated },
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

export async function translateModContent(modId: string, sourceLocale = "en") {
  const mod = await prisma.mod.findUnique({ where: { id: modId } });
  if (!mod) return [];

  const jobs = [];
  for (const locale of SUPPORTED_LOCALES) {
    if (locale === sourceLocale) continue;
    jobs.push(
      queueTranslation({
        entityType: "Mod",
        entityId: modId,
        field: "title",
        sourceLocale,
        targetLocale: locale,
        sourceText: mod.title,
      }),
      queueTranslation({
        entityType: "Mod",
        entityId: modId,
        field: "description",
        sourceLocale,
        targetLocale: locale,
        sourceText: mod.description,
      })
    );
  }
  return Promise.all(jobs);
}

export { SUPPORTED_LOCALES };
