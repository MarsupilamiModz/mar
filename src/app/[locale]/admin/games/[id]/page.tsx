import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getAdminGame } from "@/actions/admin/games";
import { GameForm } from "@/components/admin/game-form";
import { CategoryTreeEditor } from "@/components/admin/category-tree-editor";
import { GameCoverPanel } from "@/components/admin/game-cover-panel";
import { getGameCoverOverrides } from "@/lib/branding";
import type { Locale } from "@/i18n/config";

export default async function EditGamePage({
  params: { locale, id },
}: {
  params: { locale: Locale; id: string };
}) {
  setRequestLocale(locale);
  const t = await getTranslations("admin");
  const tc = await getTranslations("common");
  const result = await getAdminGame(id);
  if (!result.success) notFound();

  const game = result.data;
  const covers = await getGameCoverOverrides();
  const coverOverride = covers[game.id] ?? null;

  return (
    <div className="space-y-8">
      <Link
        href={`/${locale}/admin/games`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {tc("back")}
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">{t("games")}: {game.name}</h1>
      <GameForm
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
          bannerUrl: game.bannerUrl,
          coverUrl: game.coverUrl,
        }}
      />
      <GameCoverPanel
        gameId={game.id}
        gameName={game.name}
        currentBanner={game.bannerUrl}
        coverOverride={coverOverride}
      />
      <CategoryTreeEditor gameId={game.id} categories={game.categories} />
    </div>
  );
}
