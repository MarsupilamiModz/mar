"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  createMod,
  updateMod,
  deleteMod,
  restoreMod,
} from "@/actions/mods";
import { CreatorModVersionUpload } from "@/components/creator/creator-mod-version-upload";
import { SoundPreviewUpload } from "@/components/creator/sound-preview-upload";
import { SoundProfileEditor } from "@/components/creator/sound-profile-editor";
import { ModMediaUploader } from "@/components/mods/mod-media-uploader";
import { mapModMedia } from "@/lib/mod-media";
import type { MediaSettings } from "@/lib/media-settings";
import { parseTags, safeFormOptional, safeFormString } from "@/lib/safe-string";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAppToast } from "@/hooks/use-app-toast";
import { type FlatCategory } from "@/lib/categories";
import { formatRoleLabel } from "@/lib/role-display";
import type { SoundAudioCategory, SoundPreviewType } from "@prisma/client";

type Game = {
  id: string;
  name: string;
  modes: { id: string; name: string; slug: string }[];
  categories: FlatCategory[];
};
type Author = { id: string; username: string; displayName: string | null; role: string };

type ModData = {
  id: string;
  slug: string;
  title: string;
  description: string;
  shortDescription: string | null;
  gameId: string;
  modeId: string | null;
  categoryId: string | null;
  authorId: string;
  pricing: string;
  priceCents: number | null;
  status: string;
  visibility: string;
  isFeatured: boolean;
  productType?: string;
  soundProfile?: {
    previewFileKey: string | null;
    coverImageKey: string | null;
    artist: string | null;
    audioCategory: SoundAudioCategory;
    durationSeconds: number | null;
    bpm: number | null;
    genre: string | null;
    previewType: SoundPreviewType;
    previewCustomSeconds: number | null;
  } | null;
  tags: { name: string }[];
  media?: {
    id: string;
    mediaType: "IMAGE" | "YOUTUBE";
    imageUrl: string | null;
    videoUrl: string | null;
    youtubeVideoId: string | null;
    orderIndex: number;
    isFeatured: boolean;
  }[];
  screenshots: { id: string; url: string }[];
  videos: { id: string; url: string; title: string | null }[];
  versions: { version: string; createdAt: Date }[];
};

function resolveCategorySelection(
  categories: FlatCategory[],
  categoryId: string | null | undefined
) {
  if (!categoryId) return { parentCategoryId: "", subcategoryId: "" };
  const cat = categories.find((c) => c.id === categoryId);
  if (!cat) return { parentCategoryId: "", subcategoryId: "" };
  if (cat.parentId) return { parentCategoryId: cat.parentId, subcategoryId: cat.id };
  return { parentCategoryId: cat.id, subcategoryId: "" };
}

function ModAssignmentFields({
  games,
  gameId,
  modeId,
  parentCategoryId,
  subcategoryId,
  onGameChange,
  onModeChange,
  onParentCategoryChange,
  onSubcategoryChange,
}: {
  games: Game[];
  gameId: string;
  modeId: string;
  parentCategoryId: string;
  subcategoryId: string;
  onGameChange: (id: string) => void;
  onModeChange: (id: string) => void;
  onParentCategoryChange: (id: string) => void;
  onSubcategoryChange: (id: string) => void;
}) {
  const t = useTranslations("admin");

  const selectedGame = games.find((g) => g.id === gameId);
  const gameModes = selectedGame?.modes ?? [];
  const requiresMode = gameModes.length > 0;

  const gameCategories = useMemo(
    () =>
      (selectedGame?.categories ?? []).filter(
        (c) => !modeId || !c.modeId || c.modeId === modeId
      ),
    [selectedGame?.categories, modeId]
  );

  const rootCategories = useMemo(
    () => gameCategories.filter((c) => !c.parentId),
    [gameCategories]
  );

  const subcategories = useMemo(
    () => gameCategories.filter((c) => c.parentId === parentCategoryId),
    [gameCategories, parentCategoryId]
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">{t("reassignGame")}</label>
        <Select value={gameId} onValueChange={onGameChange}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {games.map((g) => (
              <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {requiresMode && (
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">{t("reassignMode")}</label>
          <Select value={modeId || "__none__"} onValueChange={(v) => onModeChange(v === "__none__" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder={t("reassignMode")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">—</SelectItem>
              {gameModes.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div>
        <label className="text-xs text-muted-foreground mb-1 block">{t("reassignCategory")}</label>
        <Select
          value={parentCategoryId || "__none__"}
          onValueChange={(v) => onParentCategoryChange(v === "__none__" ? "" : v)}
        >
          <SelectTrigger><SelectValue placeholder={t("reassignCategory")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">—</SelectItem>
            {rootCategories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {subcategories.length > 0 && (
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Subcategory</label>
          <Select
            value={subcategoryId || "__none__"}
            onValueChange={(v) => onSubcategoryChange(v === "__none__" ? "" : v)}
          >
            <SelectTrigger><SelectValue placeholder="Subcategory" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">—</SelectItem>
              {subcategories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

export function ModAdminPanel({
  locale,
  games,
  authors,
  mod,
  mediaSettings,
  isAdmin = false,
  redirectBase,
}: {
  locale: string;
  games: Game[];
  authors?: Author[];
  mod?: ModData;
  mediaSettings?: MediaSettings;
  isAdmin?: boolean;
  redirectBase: string;
}) {
  const t = useTranslations("admin");
  const tc = useTranslations("creator");
  const tm = useTranslations("mods");
  const appToast = useAppToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const initialCategories = games.find((g) => g.id === (mod?.gameId ?? games[0]?.id))?.categories ?? [];
  const initialCat = resolveCategorySelection(initialCategories, mod?.categoryId);

  const [gameId, setGameId] = useState(mod?.gameId ?? games[0]?.id ?? "");
  const [modeId, setModeId] = useState(mod?.modeId ?? "");
  const [parentCategoryId, setParentCategoryId] = useState(initialCat.parentCategoryId);
  const [subcategoryId, setSubcategoryId] = useState(initialCat.subcategoryId);
  const [pricing, setPricing] = useState<"FREE" | "PREMIUM" | "PAID">(
    (mod?.pricing as "FREE" | "PREMIUM" | "PAID") ?? "FREE"
  );
  const [authorId, setAuthorId] = useState(mod?.authorId ?? authors?.[0]?.id ?? "");
  const [status, setStatus] = useState(mod?.status ?? "DRAFT");
  const [isFeatured, setIsFeatured] = useState(mod?.isFeatured ?? false);

  const resolvedCategoryId = subcategoryId || parentCategoryId || null;

  function onGameChange(nextGameId: string) {
    setGameId(nextGameId);
    setModeId("");
    setParentCategoryId("");
    setSubcategoryId("");
  }

  function onModeChange(nextModeId: string) {
    setModeId(nextModeId);
    setParentCategoryId("");
    setSubcategoryId("");
  }

  if (mod) {
    const isSound = mod.productType === "SOUND";
    return (
      <div className="space-y-6 max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{mod.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">/{mod.slug}</p>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline">{isSound ? "SOUND" : "MOD"}</Badge>
            <Badge variant="outline">{mod.status}</Badge>
            {mod.isFeatured && <Badge variant="premium">{t("featured")}</Badge>}
          </div>
        </div>

        <Card className="glass p-6 space-y-4">
          <h3 className="font-medium">{t("editMod")}</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const tags = parseTags(fd.get("tags"));
              startTransition(async () => {
                const priceRaw = fd.get("priceCents");
                const priceCredits =
                  pricing === "PAID" && priceRaw ? Math.max(0, Math.round(Number(priceRaw))) : undefined;
                const r = await updateMod(mod.id, {
                  title: fd.get("title") as string,
                  description: fd.get("description") as string,
                  shortDescription: (fd.get("shortDescription") as string) || undefined,
                  gameId,
                  modeId: modeId || null,
                  categoryId: resolvedCategoryId,
                  pricing,
                  priceCents: priceCredits,
                  tags,
                  ...(isAdmin && {
                    status: status as never,
                    isFeatured,
                    authorId: authorId || undefined,
                  }),
                });
                if (r.success) {
                  appToast.saved();
                  router.refresh();
                } else appToast.error(r.error);
              });
            }}
            className="space-y-4"
          >
            <Input name="title" defaultValue={mod.title} required />
            <Input name="shortDescription" defaultValue={mod.shortDescription ?? ""} maxLength={300} />
            <Textarea name="description" defaultValue={mod.description} required rows={5} />

            {!isSound && (
              <ModAssignmentFields
                games={games}
                gameId={gameId}
                modeId={modeId}
                parentCategoryId={parentCategoryId}
                subcategoryId={subcategoryId}
                onGameChange={onGameChange}
                onModeChange={onModeChange}
                onParentCategoryChange={setParentCategoryId}
                onSubcategoryChange={setSubcategoryId}
              />
            )}

            {isAdmin && authors && (
              <Select value={authorId} onValueChange={setAuthorId}>
                <SelectTrigger><SelectValue placeholder={t("assignAuthor")} /></SelectTrigger>
                <SelectContent>
                  {authors.map((a) => (
                    <SelectItem key={a.id} value={a.id}>@{a.username}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="grid gap-4 sm:grid-cols-3">
              <Select value={pricing} onValueChange={(v) => setPricing(v as typeof pricing)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FREE">{tm("free")}</SelectItem>
                  <SelectItem value="PREMIUM">{tm("premium")}</SelectItem>
                  <SelectItem value="PAID">{tm("paid")}</SelectItem>
                </SelectContent>
              </Select>
              {isAdmin && (
                <>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["DRAFT", "PENDING", "PUBLISHED", "REJECTED", "ARCHIVED"].map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} />
                    {t("featured")}
                  </label>
                </>
              )}
            </div>
            <Input name="tags" defaultValue={mod.tags.map((t) => t.name).join(", ")} />
            {pricing === "PAID" && (
              <Input name="priceCents" type="number" defaultValue={mod.priceCents ?? 0} min={0} step={100} placeholder="Price (Credits)" />
            )}
            <Button type="submit" variant="neon" disabled={pending}>{tc("manageMod")}</Button>
          </form>
        </Card>

        {isSound && (
          <>
            <SoundProfileEditor modId={mod.id} profile={mod.soundProfile ?? null} />
            <SoundPreviewUpload
              modId={mod.id}
              hasPreview={!!mod.soundProfile?.previewFileKey}
              hasCover={!!mod.soundProfile?.coverImageKey}
            />
          </>
        )}

        <CreatorModVersionUpload modId={mod.id} />

        {!isSound && (
          <ModMediaUploader
            modId={mod.id}
            media={mapModMedia(mod.media ?? [])}
            settings={mediaSettings ?? { minScreenshots: 0, maxScreenshots: 15, allowedTypes: ["image/jpeg", "image/png", "image/webp"], maxFileSizeMb: 5, imageQuality: 0.85 }}
          />
        )}

        {isAdmin && (
          <Card className="glass p-6 border-destructive/20 space-y-4">
            <h3 className="font-semibold text-destructive">Danger zone</h3>
            <p className="text-sm text-muted-foreground">
              Soft delete archives the mod. Permanent delete removes all data.
            </p>
            <div className="flex flex-wrap gap-2">
              {mod.status === "ARCHIVED" ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => {
                    if (!window.confirm("Restore this mod?")) return;
                    startTransition(async () => {
                      const r = await restoreMod(mod.id);
                      if (r.success) {
                        appToast.updated("Mod restored");
                        router.refresh();
                      } else appToast.error(r.error);
                    });
                  }}
                >
                  Restore mod
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => {
                    if (!window.confirm("Soft delete (archive) this mod?")) return;
                    startTransition(async () => {
                      const r = await deleteMod(mod.id, false);
                      if (r.success) {
                        appToast.updated("Mod archived");
                        router.refresh();
                      } else appToast.error(r.error);
                    });
                  }}
                >
                  Soft delete
                </Button>
              )}
              <Button
                type="button"
                variant="destructive"
                disabled={pending}
                onClick={() => {
                  if (!window.confirm("Permanently delete this mod? This cannot be undone.")) return;
                  startTransition(async () => {
                    const r = await deleteMod(mod.id, true);
                    if (r.success) {
                      appToast.deleted("Mod deleted");
                      router.push(`/${locale}${redirectBase}`);
                    } else appToast.error(r.error);
                  });
                }}
              >
                Permanent delete
              </Button>
            </div>
          </Card>
        )}
      </div>
    );
  }

  return (
    <Card className="glass p-6 max-w-2xl">
      <h2 className="text-lg font-semibold mb-4">{t("uploadMod")}</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const tags = parseTags(fd.get("tags"));
          startTransition(async () => {
            const r = await createMod({
              productType: "MOD",
              title: safeFormString(fd, "title"),
              description: safeFormString(fd, "description"),
              shortDescription: safeFormOptional(fd, "shortDescription"),
              gameId,
              modeId: modeId || undefined,
              categoryId: resolvedCategoryId ?? undefined,
              pricing,
              priceCents: pricing === "PAID" ? Number(fd.get("priceCents")) * 100 : undefined,
              tags,
              ...(isAdmin && authorId ? { authorId } : {}),
            });
            if (r.success) {
              appToast.created();
              router.push(`/${locale}${redirectBase}/${r.data.id}`);
            } else appToast.error(r.error);
          });
        }}
        className="space-y-4"
      >
        <Input name="title" placeholder="Title" required minLength={3} />
        <Input name="shortDescription" placeholder="Short description" maxLength={300} />
        <Textarea name="description" placeholder="Full description" required minLength={20} rows={6} />

        <ModAssignmentFields
          games={games}
          gameId={gameId}
          modeId={modeId}
          parentCategoryId={parentCategoryId}
          subcategoryId={subcategoryId}
          onGameChange={onGameChange}
          onModeChange={onModeChange}
          onParentCategoryChange={setParentCategoryId}
          onSubcategoryChange={setSubcategoryId}
        />

        {isAdmin && authors && (
          <Select value={authorId} onValueChange={setAuthorId}>
            <SelectTrigger><SelectValue placeholder={t("assignAuthor")} /></SelectTrigger>
            <SelectContent>
              {authors.map((a) => (
                <SelectItem key={a.id} value={a.id}>@{a.username} ({formatRoleLabel(a.role)})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={pricing} onValueChange={(v) => setPricing(v as typeof pricing)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="FREE">Free</SelectItem>
            <SelectItem value="PREMIUM">Premium</SelectItem>
            <SelectItem value="PAID">Paid</SelectItem>
          </SelectContent>
        </Select>
        {pricing === "PAID" && <Input name="priceCents" type="number" min={0} step={0.01} placeholder="Price USD" />}
        <Input name="tags" placeholder="ui, hud, minimap" />
        <Button type="submit" variant="neon" disabled={pending}>{t("uploadMod")}</Button>
      </form>
    </Card>
  );
}
