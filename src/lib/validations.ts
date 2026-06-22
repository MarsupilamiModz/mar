import { z } from "zod";

export const modCreateSchema = z.object({
  productType: z.enum(["MOD", "SOUND"]).default("MOD"),
  title: z.string().min(3).max(120),
  description: z.string().min(20).max(50000),
  shortDescription: z.string().max(300).optional(),
  gameId: z.string().cuid(),
  modeId: z.string().cuid().optional(),
  categoryId: z.string().cuid().optional(),
  pricing: z.enum(["FREE", "PREMIUM", "PAID"]),
  priceCents: z.number().int().min(0).optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  supportedVersions: z.array(z.string()).optional(),
  sound: z
    .object({
      artist: z.string().max(120).optional(),
      audioCategory: z.enum([
        "ENGINE_SOUNDS",
        "WEAPON_SOUNDS",
        "SIRENS",
        "UI_SOUNDS",
        "AMBIENT_SOUNDS",
        "RADIO_PACKS",
        "VOICE_PACKS",
        "EFFECTS",
        "MUSIC_PACKS",
        "CUSTOM_AUDIO",
      ]),
      durationSeconds: z.number().int().min(0).max(86400).optional(),
      bpm: z.number().int().min(0).max(999).optional(),
      genre: z.string().max(80).optional(),
      previewType: z
        .enum(["FULL", "SECONDS_30", "SECONDS_60", "CUSTOM"])
        .default("FULL"),
      previewCustomSeconds: z.number().int().min(5).max(600).optional(),
    })
    .optional(),
});

export const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().max(100).optional(),
  content: z.string().max(5000).optional(),
});

export const customOrderSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(20).max(10000),
  orderType: z.enum(["redux_minimap", "custom_hud", "ui_package", "commission"]),
  budgetCents: z.number().int().min(0).optional(),
});

export const couponSchema = z.object({
  code: z.string().min(3).max(32).regex(/^[A-Z0-9_-]+$/i),
  type: z.enum(["PERCENT", "FIXED"]),
  value: z.number().int().positive(),
  maxUses: z.number().int().positive().optional(),
  expiresAt: z.string().datetime().optional(),
  appliesTo: z.enum(["all", "subscription", "product"]).default("all"),
});

export const licenseKeyBatchSchema = z.object({
  count: z.number().int().min(1).max(1000),
  productType: z.string().min(1),
  modId: z.string().cuid().optional(),
  expiresAt: z.string().datetime().optional(),
});

import { zSlugInput } from "@/lib/slug";

export const gameSchema = z.object({
  name: z.string().min(2).max(80),
  slug: zSlugInput,
  description: z.string().max(2000).optional(),
  isFeatured: z.boolean().optional(),
});
