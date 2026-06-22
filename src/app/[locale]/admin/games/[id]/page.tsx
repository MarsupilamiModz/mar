import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getAdminGame } from "@/actions/admin/games";
import { GameAdminTabs } from "@/components/admin/game-admin-tabs";
import type { Locale } from "@/i18n/config";

export default async function EditGamePage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;

  setRequestLocale(locale);
  const t = await getTranslations("admin");
  const tc = await getTranslations("common");
  const result = await getAdminGame(id);
  if (!result.success) notFound();

  const game = result.data;

  return (
    <div className="space-y-8">
      <Link
        href={`/${locale}/admin/games`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {tc("back")}
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">{t("games")}: {game.name}</h1>
      <GameAdminTabs
        locale={locale}
        game={{
          id: game.id,
          name: game.name,
          slug: game.slug,
          description: game.description,
          shortDescription: game.shortDescription,
          seoTitle: game.seoTitle,
          seoDescription: game.seoDescription,
          isFeatured: game.isFeatured,
          isActive: game.isActive,
          sortOrder: game.sortOrder,
          iconUrl: game.iconUrl,
          logoUrl: game.logoUrl,
          backgroundUrl: game.backgroundUrl,
          bannerUrl: game.bannerUrl,
          coverUrl: game.coverUrl,
          bannerDisplayType: game.bannerDisplayType,
          bannerHeightPx: game.bannerHeightPx,
          bannerFocusX: game.bannerFocusX,
          bannerFocusY: game.bannerFocusY,
          bannerZoom: game.bannerZoom,
          bannerAlign: game.bannerAlign,
          modePickerOverlay: game.modePickerOverlay,
          modePickerBlurPx: game.modePickerBlurPx,
          modePickerGlowEnabled: game.modePickerGlowEnabled,
          modePickerAnimation: game.modePickerAnimation,
          modePickerOpacity: game.modePickerOpacity,
          _count: game._count,
        }}
        categories={game.categories}
        modes={game.modes}
      />
    </div>
  );
}
