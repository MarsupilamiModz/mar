import { GLOBAL_LANGUAGE_CATALOG } from "@/lib/language-catalog";
import { locales } from "@/i18n/config";

/** All target locales for AI content translation (UI routing may be a subset). */
export const CONTENT_TARGET_LOCALES = GLOBAL_LANGUAGE_CATALOG.map((l) => l.code);

/** Locales with full UI message files. */
export const UI_LOCALES = [...locales] as string[];

export type TranslatableEntityType =
  | "Mod"
  | "Game"
  | "GameCategory"
  | "CreatorProfile"
  | "PartnerProfile"
  | "ShopProduct"
  | "ShopCategory"
  | "Announcement"
  | "BlogPost"
  | "MembershipPlan";

export const ENTITY_TRANSLATABLE_FIELDS: Record<TranslatableEntityType, string[]> = {
  Mod: ["title", "description", "shortDescription"],
  Game: ["name", "description"],
  GameCategory: ["name", "description"],
  CreatorProfile: ["bio", "tagline"],
  PartnerProfile: ["bio", "tagline"],
  ShopProduct: ["name", "description"],
  ShopCategory: ["name", "description"],
  Announcement: ["title", "content"],
  BlogPost: ["title", "content", "excerpt"],
  MembershipPlan: ["name", "description"],
};

export function fieldsForEntity(entityType: TranslatableEntityType): string[] {
  return ENTITY_TRANSLATABLE_FIELDS[entityType] ?? [];
}
