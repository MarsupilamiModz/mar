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
import { formatRoleLabel } from "@/lib/role-display";
import { SOUND_CATEGORIES, PREVIEW_TYPES } from "@/lib/sound";
import type { SoundAudioCategory, SoundPreviewType } from "@prisma/client";

type Game = { id: string; name: string; categories: FlatCategory[] };
type Author = { id: string; username: string; displayName: string | null; role: string };

const NONE = "__none__";

export function AdminSoundUploadPanel({
  locale,
  games,
  authors,
}: {
  locale: string;
  games: Game[];
  authors: Author[];
}) {
  const t = useTranslations("admin");
  const ts = useTranslations("sounds");
  const tm = useTranslations("mods");
  const tc = useTranslations("common");
  const appToast = useAppToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [gameId, setGameId] = useState(games[0]?.id ?? NONE);
  const [categoryId, setCategoryId] = useState(NONE);
  const [authorId, setAuthorId] = useState(authors[0]?.id ?? NONE);
  const [pricing, setPricing] = useState<"FREE" | "PREMIUM" | "PAID">("FREE");
  const [audioCategory, setAudioCategory] = useState<SoundAudioCategory>("CUSTOM_AUDIO");
  const [previewType, setPreviewType] = useState<SoundPreviewType>("FULL");

  const resolvedGameId = gameId === NONE ? "" : gameId;
  const resolvedAuthorId = authorId === NONE ? "" : authorId;
  const gameCategories = formatCategoryOptions(
    (games.find((g) => g.id === resolvedGameId)?.categories ?? []) as FlatCategory[]
  );

  if (games.length === 0 || authors.length === 0) {
    return (
      <Card className="glass p-6 max-w-2xl">
        <p className="text-sm text-muted-foreground">
          {games.length === 0
            ? "Add at least one game before uploading sounds."
            : "No creators found — assign an author after creating a creator account."}
        </p>
      </Card>
    );
  }

  return (
    <Card className="glass p-6 max-w-2xl">
      <p className="text-sm text-muted-foreground mb-4">{t("uploadSoundHint")}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!resolvedGameId || !resolvedAuthorId) {
            appToast.error("Select a game and author");
            return;
          }
          const fd = new FormData(e.currentTarget);
          const tags = (fd.get("tags") as string)
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean);

          startTransition(async () => {
            const r = await createMod({
              productType: "SOUND",
              title: fd.get("title") as string,
              description: fd.get("description") as string,
              shortDescription: (fd.get("shortDescription") as string) || undefined,
              gameId: resolvedGameId,
              categoryId: categoryId !== NONE ? categoryId : undefined,
              pricing,
              priceCents: pricing === "PAID" ? Number(fd.get("priceCents")) * 100 : undefined,
              tags,
              authorId: resolvedAuthorId,
              sound: {
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
              },
            });
            if (r.success) {
              appToast.created();
              router.push(`/${locale}/admin/mods/${r.data.id}`);
            } else appToast.error(r.error);
          });
        }}
        className="space-y-4"
      >
        <Select value={authorId} onValueChange={setAuthorId}>
          <SelectTrigger><SelectValue placeholder={t("assignAuthor")} /></SelectTrigger>
          <SelectContent>
            {authors.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                @{a.username} ({formatRoleLabel(a.role)})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input name="title" placeholder={ts("soundTitle")} required minLength={3} />
        <Input name="artist" placeholder={ts("artist")} />
        <Input name="shortDescription" placeholder={tm("search")} maxLength={300} />
        <Textarea name="description" placeholder={t("soundDescription")} required minLength={20} rows={5} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Select value={gameId} onValueChange={setGameId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {games.map((g) => (
                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>—</SelectItem>
              {gameCategories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Select value={audioCategory} onValueChange={(v) => setAudioCategory(v as SoundAudioCategory)}>
          <SelectTrigger><SelectValue placeholder={ts("audioCategory")} /></SelectTrigger>
          <SelectContent>
            {SOUND_CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {ts(`categories.${c.labelKey}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="grid gap-4 sm:grid-cols-3">
          <Input name="durationSeconds" type="number" min={0} placeholder={ts("duration")} />
          <Input name="bpm" type="number" min={0} placeholder={ts("bpm")} />
          <Input name="genre" placeholder={ts("genre")} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Select value={previewType} onValueChange={(v) => setPreviewType(v as SoundPreviewType)}>
            <SelectTrigger><SelectValue placeholder={ts("previewType")} /></SelectTrigger>
            <SelectContent>
              {PREVIEW_TYPES.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {ts(`preview.${p.labelKey}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {previewType === "CUSTOM" && (
            <Input name="previewCustomSeconds" type="number" min={5} max={600} placeholder={ts("previewCustomSeconds")} />
          )}
        </div>

        <Select value={pricing} onValueChange={(v) => setPricing(v as typeof pricing)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="FREE">{tm("free")}</SelectItem>
            <SelectItem value="PREMIUM">{tm("premium")}</SelectItem>
            <SelectItem value="PAID">{tm("paid")}</SelectItem>
          </SelectContent>
        </Select>
        {pricing === "PAID" && (
          <Input name="priceCents" type="number" min={0} step={0.01} placeholder="Price USD" />
        )}
        <Input name="tags" placeholder="ambient, menu, cinematic" />

        <Button type="submit" variant="neon" disabled={pending}>
          {pending ? tc("loading") : t("uploadSound")}
        </Button>
      </form>
    </Card>
  );
}
