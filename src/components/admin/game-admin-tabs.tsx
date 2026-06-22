"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GameForm } from "@/components/admin/game-form";
import { GameBannerSettings } from "@/components/admin/game-banner-settings";
import { CategoryTreeEditor } from "@/components/admin/category-tree-editor";
import { GameModeEditor, type AdminGameMode } from "@/components/admin/game-mode-editor";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "next-intl";
import type { FlatCategory } from "@/lib/categories";

type GameData = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  shortDescription?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  isFeatured: boolean;
  isActive: boolean;
  sortOrder: number;
  iconUrl?: string | null;
  logoUrl?: string | null;
  backgroundUrl?: string | null;
  bannerUrl?: string | null;
  coverUrl?: string | null;
  bannerDisplayType: string;
  bannerHeightPx: number | null;
  bannerFocusX: number;
  bannerFocusY: number;
  bannerZoom: number;
  bannerAlign: string;
  modePickerOverlay?: number;
  modePickerBlurPx?: number;
  modePickerGlowEnabled?: boolean;
  modePickerAnimation?: string;
  modePickerOpacity?: number;
  _count?: { mods: number; categories: number; modes?: number };
};

export function GameAdminTabs({
  locale,
  game,
  categories,
  modes,
}: {
  locale: string;
  game: GameData;
  categories: FlatCategory[];
  modes: AdminGameMode[];
}) {
  const t = useTranslations("admin");

  return (
    <Tabs defaultValue="general" className="space-y-6">
      <TabsList className="glass flex h-auto flex-wrap gap-1 p-1">
        <TabsTrigger value="general">{t("tabGeneral")}</TabsTrigger>
        <TabsTrigger value="modes">{t("gameModes")}</TabsTrigger>
        <TabsTrigger value="categories">{t("tabCategories")}</TabsTrigger>
        <TabsTrigger value="banner">{t("tabBanner")}</TabsTrigger>
        <TabsTrigger value="seo">{t("tabSeo")}</TabsTrigger>
        <TabsTrigger value="stats">{t("tabStats")}</TabsTrigger>
      </TabsList>

      <TabsContent value="general" className="space-y-6">
        <GameForm locale={locale} game={game} />
      </TabsContent>

      <TabsContent value="modes">
        <GameModeEditor
          gameId={game.id}
          gameSlug={game.slug}
          modes={modes}
          pickerSettings={{
            modePickerOverlay: game.modePickerOverlay ?? 0.72,
            modePickerBlurPx: game.modePickerBlurPx ?? 16,
            modePickerGlowEnabled: game.modePickerGlowEnabled ?? true,
            modePickerAnimation: game.modePickerAnimation ?? "fade",
            modePickerOpacity: game.modePickerOpacity ?? 0.85,
          }}
        />
      </TabsContent>

      <TabsContent value="categories">
        <CategoryTreeEditor gameId={game.id} categories={categories} />
      </TabsContent>

      <TabsContent value="banner">
        <GameBannerSettings
          gameId={game.id}
          bannerUrl={game.bannerUrl}
          coverUrl={game.coverUrl}
          settings={{
            bannerDisplayType: game.bannerDisplayType as "SMALL" | "FEATURED" | "CUSTOM",
            bannerHeightPx: game.bannerHeightPx,
            bannerFocusX: game.bannerFocusX,
            bannerFocusY: game.bannerFocusY,
            bannerZoom: game.bannerZoom,
            bannerAlign: game.bannerAlign as "CENTER" | "TOP" | "BOTTOM" | "LEFT" | "RIGHT",
          }}
        />
      </TabsContent>

      <TabsContent value="seo">
        <Card className="glass p-6 text-sm text-muted-foreground">
          <p>{t("seoTabHint")}</p>
          <dl className="mt-4 space-y-2">
            <div>
              <dt className="font-medium text-foreground">SEO Title</dt>
              <dd>{game.seoTitle ?? game.name}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">SEO Description</dt>
              <dd>{game.seoDescription ?? "—"}</dd>
            </div>
          </dl>
        </Card>
      </TabsContent>

      <TabsContent value="stats">
        <Card className="glass p-6">
          <div className="flex flex-wrap gap-3">
            <Badge variant="outline">{game._count?.mods ?? 0} mods</Badge>
            <Badge variant="outline">{modes.length} modes</Badge>
            <Badge variant="outline">{game._count?.categories ?? 0} categories</Badge>
          </div>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
