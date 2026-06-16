"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { createMod } from "@/actions/mods";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { useAppToast } from "@/hooks/use-app-toast";
import { formatCategoryOptions, type FlatCategory } from "@/lib/categories";
import { SOUND_CATEGORIES, PREVIEW_TYPES } from "@/lib/sound";
import type { SoundAudioCategory, SoundPreviewType } from "@prisma/client";

type Game = { id: string; name: string };
type Category = FlatCategory & { gameId: string };

export function ProductForm({
  locale,
  games,
  categories,
}: {
  locale: string;
  games: Game[];
  categories: Category[];
}) {
  const t = useTranslations("creator");
  const ts = useTranslations("sounds");
  const tm = useTranslations("mods");
  const tc = useTranslations("common");
  const appToast = useAppToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [productType, setProductType] = useState<"MOD" | "SOUND">("MOD");
  const [gameId, setGameId] = useState(games[0]?.id ?? "");
  const [pricing, setPricing] = useState<"FREE" | "PREMIUM" | "PAID">("FREE");
  const [audioCategory, setAudioCategory] = useState<SoundAudioCategory>("CUSTOM_AUDIO");
  const [previewType, setPreviewType] = useState<SoundPreviewType>("FULL");

  const gameCategories = formatCategoryOptions(categories.filter((c) => c.gameId === gameId));

  return (
    <Card className="glass p-6 max-w-2xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const tags = (fd.get("tags") as string)
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean);

          startTransition(async () => {
            const r = await createMod({
              productType,
              title: fd.get("title") as string,
              description: fd.get("description") as string,
              shortDescription: (fd.get("shortDescription") as string) || undefined,
              gameId,
              categoryId: productType === "MOD" ? (fd.get("categoryId") as string) || undefined : undefined,
              pricing,
              priceCents: pricing === "PAID" ? Number(fd.get("priceCents")) * 100 : undefined,
              tags,
              sound:
                productType === "SOUND"
                  ? {
                      artist: (fd.get("artist") as string) || undefined,
                      audioCategory,
                      durationSeconds: fd.get("durationSeconds")
                        ? Number(fd.get("durationSeconds"))
                        : undefined,
                      bpm: fd.get("bpm") ? Number(fd.get("bpm")) : undefined,
                      genre: (fd.get("genre") as string) || undefined,
                      previewType,
                      previewCustomSeconds:
                        previewType === "CUSTOM" && fd.get("previewCustomSeconds")
                          ? Number(fd.get("previewCustomSeconds"))
                          : undefined,
                    }
                  : undefined,
            });
            if (r.success) {
              appToast.created();
              router.push(`/${locale}/creator/mods/${r.data.id}`);
              router.refresh();
            } else appToast.error(r.error);
          });
        }}
        className="space-y-4"
      >
        <div>
          <label className="text-sm font-medium">{ts("productType")} *</label>
          <Select value={productType} onValueChange={(v) => setProductType(v as "MOD" | "SOUND")}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MOD">{ts("typeMod")}</SelectItem>
              <SelectItem value="SOUND">{ts("typeSound")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium">
            {productType === "SOUND" ? ts("soundTitle") : t("newMod")} *
          </label>
          <Input name="title" required minLength={3} className="mt-1" />
        </div>

        {productType === "SOUND" && (
          <div>
            <label className="text-sm font-medium">{ts("artist")}</label>
            <Input name="artist" className="mt-1" />
          </div>
        )}

        <div>
          <label className="text-sm font-medium">{tm("search")}</label>
          <Input name="shortDescription" maxLength={300} className="mt-1" />
        </div>

        <div>
          <label className="text-sm font-medium">{t("manageMod")} *</label>
          <Textarea name="description" required minLength={20} rows={6} className="mt-1" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium">{t("myMods")} *</label>
            <Select value={gameId} onValueChange={setGameId}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {games.map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {productType === "MOD" ? (
            <div>
              <label className="text-sm font-medium">{t("manageMod")}</label>
              <select name="categoryId" className="mt-1 flex h-10 w-full rounded-md border border-input bg-background/50 px-3 text-sm">
                <option value="">—</option>
                {gameCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="text-sm font-medium">{ts("audioCategory")} *</label>
              <Select value={audioCategory} onValueChange={(v) => setAudioCategory(v as SoundAudioCategory)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SOUND_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {ts(`categories.${c.labelKey}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {productType === "SOUND" && (
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="text-sm font-medium">{ts("duration")}</label>
              <Input name="durationSeconds" type="number" min={0} placeholder="210" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">{ts("bpm")}</label>
              <Input name="bpm" type="number" min={0} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">{ts("genre")}</label>
              <Input name="genre" className="mt-1" />
            </div>
          </div>
        )}

        {productType === "SOUND" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium">{ts("previewType")}</label>
              <Select value={previewType} onValueChange={(v) => setPreviewType(v as SoundPreviewType)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PREVIEW_TYPES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {ts(`preview.${p.labelKey}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {previewType === "CUSTOM" && (
              <div>
                <label className="text-sm font-medium">{ts("previewCustomSeconds")}</label>
                <Input name="previewCustomSeconds" type="number" min={5} max={600} className="mt-1" />
              </div>
            )}
          </div>
        )}

        <div>
          <label className="text-sm font-medium">{tm("filter")}</label>
          <Select value={pricing} onValueChange={(v) => setPricing(v as typeof pricing)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="FREE">{tm("free")}</SelectItem>
              <SelectItem value="PREMIUM">{tm("premium")}</SelectItem>
              <SelectItem value="PAID">{tm("paid")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {pricing === "PAID" && (
          <div>
            <label className="text-sm font-medium">{tm("paid")}</label>
            <Input name="priceCents" type="number" min={0} step={0.01} className="mt-1" />
          </div>
        )}

        <div>
          <label className="text-sm font-medium">Tags</label>
          <Input name="tags" placeholder="ui, hud, realism" className="mt-1" />
        </div>

        <Button type="submit" variant="neon" disabled={pending}>
          {pending ? tc("loading") : productType === "SOUND" ? ts("createSound") : t("createMod")}
        </Button>
      </form>
    </Card>
  );
}

/** @deprecated Use ProductForm */
export const ModForm = ProductForm;
