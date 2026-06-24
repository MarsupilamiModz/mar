import { createHash } from "node:crypto";
import { getCachedTranslation, setCachedTranslation } from "@/lib/translation-cache";

export type TranslationProvider = "openai" | "deepl" | "azure" | "google" | "fallback";

const PROTECTED_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /https?:\/\/[^\s]+/gi, label: "URL" },
  { re: /@[\w.-]+/g, label: "HANDLE" },
  { re: /\b\d+\.\d+\.\d+[\w.-]*/g, label: "VERSION" },
  { re: /\b(?:v|V)\d+(?:\.\d+)+\b/g, label: "VERSION" },
  { re: /#[\w-]+/g, label: "TAG" },
];

export function protectUntranslatable(text: string): { protectedText: string; tokens: Map<string, string> } {
  const tokens = new Map<string, string>();
  let protectedText = text;
  let index = 0;

  for (const { re } of PROTECTED_PATTERNS) {
    protectedText = protectedText.replace(re, (match) => {
      const key = `⟦KEEP${index++}⟧`;
      tokens.set(key, match);
      return key;
    });
  }

  return { protectedText, tokens };
}

export function restoreProtected(text: string, tokens: Map<string, string>): string {
  let out = text;
  for (const [key, value] of Array.from(tokens.entries())) {
    out = out.split(key).join(value);
  }
  return out;
}

export function translationCacheKey(sourceLocale: string, targetLocale: string, text: string): string {
  return createHash("sha256")
    .update(`${sourceLocale}:${targetLocale}:${text}`)
    .digest("hex");
}

/** Heuristic source-language detection (titles like "BMW M5 Sound" stay as-is). */
export function detectSourceLocale(text: string, hint?: string): string {
  if (hint && hint !== "auto") return hint;
  const sample = text.trim().slice(0, 500);
  if (!sample) return "en";
  if (/[\u0400-\u04FF]/.test(sample)) return "ru";
  if (/[\u4E00-\u9FFF]/.test(sample)) return "zh";
  if (/[\u3040-\u30FF]/.test(sample)) return "ja";
  if (/[\uAC00-\uD7AF]/.test(sample)) return "ko";
  if (/[\u0600-\u06FF]/.test(sample)) return "ar";
  if (/[äöüßÄÖÜ]/.test(sample)) return "de";
  if (/[àâçéèêëïîôùûüœæ]/i.test(sample)) return "fr";
  if (/[áéíóúñ¿¡]/i.test(sample)) return "es";
  if (/[ąćęłńóśźż]/i.test(sample)) return "pl";
  if (/[ğışöüç]/i.test(sample)) return "tr";
  return "en";
}

function activeProvider(): TranslationProvider {
  if (process.env.DEEPL_API_KEY) return "deepl";
  if (process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_API_KEY) return "azure";
  if (process.env.GOOGLE_TRANSLATE_API_KEY) return "google";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "fallback";
}

async function translateWithOpenAI(
  text: string,
  sourceLocale: string,
  targetLocale: string,
  field?: string
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

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
          content: `You translate gaming marketplace content from ${sourceLocale} to ${targetLocale}. Field: ${field ?? "general"}. Preserve ⟦KEEPn⟧ tokens exactly. Keep brand names, mod titles, file names, and proper nouns unchanged. Return only the translation.`,
        },
        { role: "user", content: text },
      ],
      temperature: 0.2,
    }),
  });

  if (!res.ok) throw new Error((await res.text()).slice(0, 500));
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const out = data.choices?.[0]?.message?.content?.trim();
  if (!out) throw new Error("Empty OpenAI translation");
  return out;
}

async function translateWithDeepL(text: string, sourceLocale: string, targetLocale: string): Promise<string> {
  const key = process.env.DEEPL_API_KEY;
  if (!key) throw new Error("DEEPL_API_KEY not configured");
  const body = new URLSearchParams({
    text,
    source_lang: sourceLocale.toUpperCase().slice(0, 2),
    target_lang: targetLocale.toUpperCase().slice(0, 2),
  });
  const res = await fetch("https://api-free.deepl.com/v2/translate", {
    method: "POST",
    headers: { Authorization: `DeepL-Auth-Key ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error((await res.text()).slice(0, 500));
  const data = (await res.json()) as { translations?: { text: string }[] };
  const out = data.translations?.[0]?.text?.trim();
  if (!out) throw new Error("Empty DeepL translation");
  return out;
}

async function translateWithGoogle(text: string, sourceLocale: string, targetLocale: string): Promise<string> {
  const key = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!key) throw new Error("GOOGLE_TRANSLATE_API_KEY not configured");
  const url = new URL("https://translation.googleapis.com/language/translate/v2");
  url.searchParams.set("key", key);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ q: text, source: sourceLocale, target: targetLocale, format: "text" }),
  });
  if (!res.ok) throw new Error((await res.text()).slice(0, 500));
  const data = (await res.json()) as { data?: { translations?: { translatedText: string }[] } };
  const out = data.data?.translations?.[0]?.translatedText?.trim();
  if (!out) throw new Error("Empty Google translation");
  return out;
}

export type TranslateTextInput = {
  text: string;
  sourceLocale?: string;
  targetLocale: string;
  field?: string;
  entityType?: string;
  skipCache?: boolean;
};

/** Central translation engine — cache, provider routing, smart protection. */
export async function translateText(input: TranslateTextInput): Promise<{
  text: string;
  provider: TranslationProvider;
  cached: boolean;
  sourceLocale: string;
}> {
  const raw = input.text?.trim() ?? "";
  if (!raw) return { text: "", provider: "fallback", cached: true, sourceLocale: "en" };
  if (input.targetLocale === (input.sourceLocale ?? detectSourceLocale(raw))) {
    return { text: raw, provider: "fallback", cached: true, sourceLocale: input.sourceLocale ?? "en" };
  }

  const sourceLocale = input.sourceLocale ?? detectSourceLocale(raw);
  const cacheKey = translationCacheKey(sourceLocale, input.targetLocale, raw);

  if (!input.skipCache) {
    const hit = await getCachedTranslation(cacheKey);
    if (hit) return { text: hit, provider: "fallback", cached: true, sourceLocale };
  }

  const { protectedText, tokens } = protectUntranslatable(raw);
  const provider = activeProvider();
  let translated: string;

  try {
    if (provider === "deepl") {
      translated = await translateWithDeepL(protectedText, sourceLocale, input.targetLocale);
    } else if (provider === "google") {
      translated = await translateWithGoogle(protectedText, sourceLocale, input.targetLocale);
    } else if (provider === "openai" || provider === "azure") {
      translated = await translateWithOpenAI(protectedText, sourceLocale, input.targetLocale, input.field);
    } else {
      return { text: raw, provider: "fallback", cached: false, sourceLocale };
    }
  } catch (err) {
    if (provider !== "openai" && process.env.OPENAI_API_KEY) {
      translated = await translateWithOpenAI(protectedText, sourceLocale, input.targetLocale, input.field);
    } else {
      throw err;
    }
  }

  const restored = restoreProtected(translated, tokens);
  await setCachedTranslation(cacheKey, restored, {
    sourceLocale,
    targetLocale: input.targetLocale,
    sourceText: raw,
    provider,
  });

  return { text: restored, provider, cached: false, sourceLocale };
}

export function getTranslationEngineStatus() {
  return {
    provider: activeProvider(),
    openai: Boolean(process.env.OPENAI_API_KEY),
    deepl: Boolean(process.env.DEEPL_API_KEY),
    google: Boolean(process.env.GOOGLE_TRANSLATE_API_KEY),
    azure: Boolean(process.env.AZURE_OPENAI_API_KEY),
    autoApprove: process.env.TRANSLATION_REQUIRE_APPROVAL !== "true",
  };
}
