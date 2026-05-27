"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  createMod,
  updateMod,
  uploadModVersion,
} from "@/actions/mods";
import { ModMediaUploader } from "@/components/mods/mod-media-uploader";
import { mapModMedia } from "@/lib/mod-media";
import type { MediaSettings } from "@/lib/media-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAppToast } from "@/hooks/use-app-toast";
import { formatCategoryOptions, type FlatCategory } from "@/lib/categories";

type Game = { id: string; name: string; categories: FlatCategory[] };
type Author = { id: string; username: string; displayName: string | null; role: string };

type ModData = {
  id: string;
  slug: string;
  title: string;
  description: string;
  shortDescription: string | null;
  gameId: string;
  categoryId: string | null;
  authorId: string;
  pricing: string;
  priceCents: number | null;
  status: string;
  visibility: string;
  isFeatured: boolean;
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
  const [gameId, setGameId] = useState(mod?.gameId ?? games[0]?.id ?? "");
  const [pricing, setPricing] = useState<"FREE" | "PREMIUM" | "PAID">(
    (mod?.pricing as "FREE" | "PREMIUM" | "PAID") ?? "FREE"
  );
  const [authorId, setAuthorId] = useState(mod?.authorId ?? authors?.[0]?.id ?? "");
  const [status, setStatus] = useState(mod?.status ?? "DRAFT");
  const [isFeatured, setIsFeatured] = useState(mod?.isFeatured ?? false);

  const gameCategories = formatCategoryOptions(
    (games.find((g) => g.id === gameId)?.categories ?? []) as FlatCategory[]
  );

  if (mod) {
    return (
      <div className="space-y-6 max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{mod.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">/{mod.slug}</p>
          </div>
          <div className="flex gap-2">
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
              const tags = (fd.get("tags") as string).split(",").map((x) => x.trim()).filter(Boolean);
              startTransition(async () => {
                const r = await updateMod(mod.id, {
                  title: fd.get("title") as string,
                  description: fd.get("description") as string,
                  shortDescription: (fd.get("shortDescription") as string) || undefined,
                  gameId,
                  categoryId: (fd.get("categoryId") as string) || undefined,
                  pricing,
                  priceCents: pricing === "PAID" ? Number(fd.get("priceCents")) * 100 : undefined,
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
            <div className="grid gap-4 sm:grid-cols-2">
              <Select value={gameId} onValueChange={setGameId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {games.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <select name="categoryId" defaultValue={mod.categoryId ?? ""} className="flex h-10 w-full rounded-md border border-input bg-background/50 px-3 text-sm">
                <option value="">—</option>
                {gameCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
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
              <Input name="priceCents" type="number" defaultValue={(mod.priceCents ?? 0) / 100} min={0} step={0.01} />
            )}
            <Button type="submit" variant="neon" disabled={pending}>{tc("manageMod")}</Button>
          </form>
        </Card>

        <Card className="glass p-6 space-y-4">
          <h3 className="font-medium">{tc("uploadVersion")}</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              startTransition(async () => {
                const r = await uploadModVersion(mod.id, new FormData(e.currentTarget));
                if (r.success) appToast.uploaded();
                else appToast.error(r.error);
              });
            }}
            className="space-y-3"
          >
            <Input name="version" placeholder="1.0.0" required />
            <Input name="gameVersion" placeholder="Game version" />
            <Textarea name="changelog" rows={2} />
            <Input name="file" type="file" required />
            <Button type="submit" variant="neon" disabled={pending}>{tc("uploadVersion")}</Button>
          </form>
        </Card>

        <ModMediaUploader
          modId={mod.id}
          media={mapModMedia(mod.media ?? [])}
          settings={mediaSettings ?? { minScreenshots: 0, maxScreenshots: 15, allowedTypes: ["image/jpeg", "image/png", "image/webp"], maxFileSizeMb: 5, imageQuality: 0.85 }}
        />
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
          const tags = (fd.get("tags") as string).split(",").map((x) => x.trim()).filter(Boolean);
          startTransition(async () => {
            const r = await createMod({
              title: fd.get("title") as string,
              description: fd.get("description") as string,
              shortDescription: (fd.get("shortDescription") as string) || undefined,
              gameId,
              categoryId: (fd.get("categoryId") as string) || undefined,
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
        <div className="grid gap-4 sm:grid-cols-2">
          <Select value={gameId} onValueChange={setGameId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {games.map((g) => (
                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <select name="categoryId" className="flex h-10 w-full rounded-md border border-input bg-background/50 px-3 text-sm">
            <option value="">—</option>
            {gameCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
        {isAdmin && authors && (
          <Select value={authorId} onValueChange={setAuthorId}>
            <SelectTrigger><SelectValue placeholder={t("assignAuthor")} /></SelectTrigger>
            <SelectContent>
              {authors.map((a) => (
                <SelectItem key={a.id} value={a.id}>@{a.username} ({a.role})</SelectItem>
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
