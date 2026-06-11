"use server";

import { readFileSync } from "fs";
import { join } from "path";
import { revalidatePath } from "next/cache";
import { locales, type Locale } from "@/i18n/config";
import { fail, ok, requireActionPermission } from "@/lib/action-utils";
import {
  flattenMessageTree,
  getAllMessageOverrides,
  importMessageOverrides,
  setMessageOverride,
} from "@/lib/message-overrides";
import { deepMergeMessages } from "@/lib/i18n-utils";

const MESSAGE_MODULES = [
  "common",
  "landing",
  "catalog",
  "premium",
  "auth",
  "dashboard",
  "admin",
  "designer",
  "creator",
  "support",
  "licenses",
  "toast",
  "ecosystem",
  "media",
  "shop",
] as const;

function loadLocaleFileTree(locale: Locale): Record<string, unknown> {
  const root = join(process.cwd(), "src", "messages", locale);
  const merged: Record<string, unknown> = {};
  for (const mod of MESSAGE_MODULES) {
    try {
      const raw = readFileSync(join(root, `${mod}.json`), "utf8");
      Object.assign(merged, JSON.parse(raw) as Record<string, unknown>);
    } catch {
      /* skip missing module */
    }
  }
  return merged;
}

export async function listAdminMessages(locale: Locale, search?: string) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  const base = loadLocaleFileTree(locale);
  const en = locale === "en" ? base : loadLocaleFileTree("en");
  const merged = locale === "en" ? base : deepMergeMessages(en, base);
  const overrides = await getAllMessageOverrides();
  const withOverrides = deepMergeMessages(
    merged,
    (overrides[locale] ?? {}) as Record<string, unknown>
  );
  const flat = flattenMessageTree(withOverrides);

  const entries = Object.entries(flat)
    .map(([key, value]) => ({ key, value }))
    .filter((row) => !search || row.key.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.key.localeCompare(b.key));

  return ok({ entries, locale, total: entries.length });
}

export async function updateAdminMessage(locale: Locale, key: string, value: string) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;
  if (!locales.includes(locale)) return fail("Invalid locale");
  if (!key.trim()) return fail("Key required");

  await setMessageOverride(locale, key.trim(), value);
  revalidatePath("/admin/localization");
  return ok(undefined);
}

export async function exportAdminMessages(locale: Locale) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  const result = await listAdminMessages(locale);
  if (!result.success) return result;

  const payload: Record<string, string> = {};
  for (const row of result.data.entries) payload[row.key] = row.value;
  return ok(payload);
}

export async function importAdminMessages(
  locale: Locale,
  payload: Record<string, string>,
  mode: "merge" | "replace" = "merge"
) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;
  if (!locales.includes(locale)) return fail("Invalid locale");

  const tree: Record<string, unknown> = {};
  for (const [path, value] of Object.entries(payload)) {
    const segments = path.split(".").filter(Boolean);
    let cursor: Record<string, unknown> = tree;
    for (let i = 0; i < segments.length - 1; i++) {
      const seg = segments[i]!;
      if (!cursor[seg] || typeof cursor[seg] !== "object") cursor[seg] = {};
      cursor = cursor[seg] as Record<string, unknown>;
    }
    cursor[segments[segments.length - 1]!] = value;
  }

  await importMessageOverrides(locale, tree, mode);
  revalidatePath("/admin/localization");
  return ok(undefined);
}
