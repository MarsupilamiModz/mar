"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  createGameMode,
  updateGameMode,
  deleteGameMode,
  duplicateGameMode,
  reorderGameModes,
  uploadGameModeAsset,
} from "@/actions/admin/game-modes";
import { updateGameModePickerSettings } from "@/actions/admin/games";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SafeImage } from "@/components/ui/safe-image";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { ChevronDown, ChevronUp, Copy, Plus, Trash2 } from "lucide-react";

export type AdminGameMode = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  thumbnailUrl: string | null;
  bannerUrl: string | null;
  backgroundUrl: string | null;
  logoUrl: string | null;
  iconUrl: string | null;
  accentColor: string | null;
  sortOrder: number;
  isActive: boolean;
};

type PickerSettings = {
  modePickerOverlay: number;
  modePickerBlurPx: number;
  modePickerGlowEnabled: boolean;
  modePickerAnimation: string;
  modePickerOpacity: number;
};

type AssetType = "thumbnail" | "banner" | "background" | "logo" | "icon";

export function GameModeEditor({
  gameId,
  gameSlug,
  modes: initial,
  pickerSettings,
}: {
  gameId: string;
  gameSlug: string;
  modes: AdminGameMode[];
  pickerSettings: PickerSettings;
}) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const router = useRouter();
  const [modes, setModes] = useState(initial);
  const [picker, setPicker] = useState(pickerSettings);
  const [pending, startTransition] = useTransition();
  const [newName, setNewName] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...modes].sort((a, b) => a.sortOrder - b.sortOrder),
    [modes]
  );

  function moveMode(id: string, dir: -1 | 1) {
    const idx = sorted.findIndex((m) => m.id === id);
    const target = idx + dir;
    if (target < 0 || target >= sorted.length) return;

    const reordered = [...sorted];
    [reordered[idx], reordered[target]] = [reordered[target], reordered[idx]];
    setModes(reordered.map((m, i) => ({ ...m, sortOrder: i })));

    startTransition(async () => {
      const r = await reorderGameModes(gameId, reordered.map((m) => m.id));
      if (!r.success) toast({ title: r.error, variant: "destructive" });
      else router.refresh();
    });
  }

  async function uploadAsset(modeId: string, type: AssetType, file: File) {
    const fd = new FormData();
    fd.set("file", file);
    startTransition(async () => {
      const r = await uploadGameModeAsset(modeId, type, fd);
      if (r.success && r.data?.url) {
        const fieldMap: Record<AssetType, keyof AdminGameMode> = {
          thumbnail: "thumbnailUrl",
          banner: "bannerUrl",
          background: "backgroundUrl",
          logo: "logoUrl",
          icon: "iconUrl",
        };
        const field = fieldMap[type];
        setModes((prev) =>
          prev.map((m) => (m.id === modeId ? { ...m, [field]: r.data!.url } : m))
        );
        toast({ title: t("gameModeSaved") });
        router.refresh();
      } else if (!r.success) toast({ title: r.error, variant: "destructive" });
    });
  }

  function savePickerSettings(next: Partial<PickerSettings>) {
    const merged = { ...picker, ...next };
    setPicker(merged);
    startTransition(async () => {
      const r = await updateGameModePickerSettings(gameId, {
        modePickerOverlay: merged.modePickerOverlay,
        modePickerBlurPx: merged.modePickerBlurPx,
        modePickerGlowEnabled: merged.modePickerGlowEnabled,
        modePickerAnimation: merged.modePickerAnimation as "fade" | "scale" | "slide",
        modePickerOpacity: merged.modePickerOpacity,
      });
      if (r.success) toast({ title: t("gameModeSaved") });
      else toast({ title: r.error, variant: "destructive" });
    });
  }

  return (
    <div className="space-y-6">
      <Card className="glass p-6 space-y-4">
        <div>
          <h3 className="font-medium">{t("modePickerSettings")}</h3>
          <p className="text-xs text-muted-foreground mt-1">{t("modePickerSettingsHint")}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="text-xs text-muted-foreground">{t("modePickerOverlay")}</label>
            <Input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={picker.modePickerOverlay}
              className="mt-1"
              onChange={(e) => savePickerSettings({ modePickerOverlay: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">{t("modePickerBlur")}</label>
            <Input
              type="number"
              min={0}
              max={64}
              value={picker.modePickerBlurPx}
              className="mt-1"
              onBlur={(e) => savePickerSettings({ modePickerBlurPx: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">{t("modePickerOpacity")}</label>
            <Input
              type="range"
              min={0.3}
              max={1}
              step={0.05}
              value={picker.modePickerOpacity}
              className="mt-1"
              onChange={(e) => savePickerSettings({ modePickerOpacity: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">{t("modePickerAnimation")}</label>
            <Select
              value={picker.modePickerAnimation}
              onValueChange={(v) => savePickerSettings({ modePickerAnimation: v })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fade">{t("animationFade")}</SelectItem>
                <SelectItem value="scale">{t("animationScale")}</SelectItem>
                <SelectItem value="slide">{t("animationSlide")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm pt-6">
            <input
              type="checkbox"
              checked={picker.modePickerGlowEnabled}
              onChange={(e) => savePickerSettings({ modePickerGlowEnabled: e.target.checked })}
            />
            {t("modePickerGlow")}
          </label>
        </div>
      </Card>

      <Card className="glass p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium">{t("gameModes")}</h3>
            <p className="text-xs text-muted-foreground mt-1">{t("gameModesHint")}</p>
          </div>
          <Badge variant="outline">{modes.length}</Badge>
        </div>

        <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
          {sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">{t("noGameModes")}</p>
          ) : (
            sorted.map((mode) => {
              const expanded = expandedId === mode.id;
              const thumb =
                mode.thumbnailUrl ?? mode.backgroundUrl ?? mode.bannerUrl ?? mode.logoUrl ?? mode.iconUrl;
              return (
                <div key={mode.id} className="rounded-lg border border-border/40 bg-background/30 overflow-hidden">
                  <div className="flex flex-wrap items-center gap-2 p-2.5">
                    <button
                      type="button"
                      className="relative h-10 w-14 shrink-0 overflow-hidden rounded-md border border-border/50"
                      onClick={() => setExpandedId(expanded ? null : mode.id)}
                    >
                      {thumb ? (
                        <SafeImage src={thumb} alt="" fill className="object-cover" sizes="56px" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                          {mode.slug}
                        </span>
                      )}
                    </button>
                    <Input
                      defaultValue={mode.name}
                      className="h-8 flex-1 min-w-[120px]"
                      onBlur={(e) => {
                        if (e.target.value === mode.name) return;
                        startTransition(async () => {
                          const r = await updateGameMode(mode.id, { name: e.target.value });
                          if (r.success) {
                            setModes((prev) =>
                              prev.map((m) => (m.id === mode.id ? { ...m, name: e.target.value } : m))
                            );
                            toast({ title: t("gameModeSaved") });
                            router.refresh();
                          } else toast({ title: r.error, variant: "destructive" });
                        });
                      }}
                    />
                    <code className="text-[10px] text-muted-foreground hidden sm:inline">{mode.slug}</code>
                    <label className="flex items-center gap-1.5 text-xs whitespace-nowrap">
                      <input
                        type="checkbox"
                        defaultChecked={mode.isActive}
                        onChange={(e) => {
                          startTransition(async () => {
                            const r = await updateGameMode(mode.id, { isActive: e.target.checked });
                            if (r.success) {
                              setModes((prev) =>
                                prev.map((m) =>
                                  m.id === mode.id ? { ...m, isActive: e.target.checked } : m
                                )
                              );
                              router.refresh();
                            }
                          });
                        }}
                      />
                      {t("visible")}
                    </label>
                    <div className="flex gap-0.5">
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" disabled={pending} onClick={() => moveMode(mode.id, -1)}>
                        <ChevronUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" disabled={pending} onClick={() => moveMode(mode.id, 1)}>
                        <ChevronDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        disabled={pending}
                        title={t("duplicateGameMode")}
                        onClick={() =>
                          startTransition(async () => {
                            const r = await duplicateGameMode(mode.id);
                            if (r.success && r.data) {
                              setModes((prev) => [...prev, r.data as AdminGameMode]);
                              toast({ title: t("gameModeDuplicated") });
                              router.refresh();
                            } else if (!r.success) toast({ title: r.error, variant: "destructive" });
                          })
                        }
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            const r = await deleteGameMode(mode.id);
                            if (r.success) {
                              setModes((prev) => prev.filter((m) => m.id !== mode.id));
                              toast({ title: t("gameModeDeleted") });
                              router.refresh();
                            } else toast({ title: r.error, variant: "destructive" });
                          })
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {expanded && (
                    <div className="border-t border-border/30 bg-background/20 p-3 space-y-3">
                      <Textarea
                        defaultValue={mode.description ?? ""}
                        rows={2}
                        placeholder={t("gameModeDescriptionPlaceholder")}
                        onBlur={(e) => {
                          const value = e.target.value;
                          if (value === (mode.description ?? "")) return;
                          startTransition(async () => {
                            await updateGameMode(mode.id, { description: value || undefined });
                            setModes((prev) =>
                              prev.map((m) => (m.id === mode.id ? { ...m, description: value || null } : m))
                            );
                          });
                        }}
                      />
                      <div className="flex flex-wrap items-end gap-3">
                        <div>
                          <label className="text-xs text-muted-foreground">{t("categoryAccentColor")}</label>
                          <Input
                            type="color"
                            defaultValue={mode.accentColor ?? "#a855f7"}
                            className="mt-1 h-9 w-16 p-1"
                            onBlur={(e) => {
                              startTransition(async () => {
                                await updateGameMode(mode.id, { accentColor: e.target.value });
                                setModes((prev) =>
                                  prev.map((m) =>
                                    m.id === mode.id ? { ...m, accentColor: e.target.value } : m
                                  )
                                );
                              });
                            }}
                          />
                        </div>
                        {(
                          [
                            ["thumbnail", "Thumbnail"],
                            ["banner", "Banner"],
                            ["background", t("gameModeBackground")],
                            ["logo", t("gameModeLogo")],
                            ["icon", "Icon"],
                          ] as const
                        ).map(([type, label]) => (
                          <div key={type}>
                            <label className="text-xs text-muted-foreground">{label}</label>
                            <Input
                              type="file"
                              accept="image/*"
                              className="mt-1 max-w-[140px] text-xs"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) void uploadAsset(mode.id, type, file);
                              }}
                            />
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t("gameModeRoutePreview")}: /games/{gameSlug}/{mode.slug}
                      </p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newName.trim()) return;
            startTransition(async () => {
              const r = await createGameMode(gameId, { name: newName.trim() });
              if (r.success && r.data) {
                setModes((prev) => [...prev, r.data as AdminGameMode]);
                setNewName("");
                toast({ title: t("gameModeCreated") });
                router.refresh();
              } else if (!r.success) toast({ title: r.error, variant: "destructive" });
            });
          }}
        >
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t("newGameModePlaceholder")}
            className="flex-1 min-w-[160px]"
          />
          <Button type="submit" variant="neon" size="sm" disabled={pending || !newName.trim()}>
            <Plus className="h-4 w-4 mr-1" />
            {tc("save")}
          </Button>
        </form>
      </Card>
    </div>
  );
}
