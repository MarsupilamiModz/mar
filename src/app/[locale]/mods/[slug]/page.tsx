import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Star, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ModCard } from "@/components/mods/mod-card";
import { ModDetailMedia } from "@/components/mods/mod-detail-media";
import { FavoriteButton } from "@/components/mods/favorite-button";
import { ReviewForm } from "@/components/mods/review-form";
import { ModDependenciesPanel } from "@/components/mods/mod-dependencies-panel";
import { ModVersionsPanel } from "@/components/mods/mod-versions-panel";
import { ModDownloadButton } from "@/components/mods/mod-download-button";
import { checkMissingDependencies } from "@/lib/mod-dependencies";
import { getModBySlug, getTrendingMods } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SITE } from "@/lib/site";
import {
  getFeaturedMediaUrl,
  getGalleryImages,
  getYouTubeVideos,
  mapModMedia,
} from "@/lib/mod-media";
import { getLocalizedModContent } from "@/lib/localization";
import { SafeImage } from "@/components/ui/safe-image";
import { UserIdentity } from "@/components/user/user-identity";
import { getInlineBadgesForUsers } from "@/lib/user-badges";
import { AdLocationSlot } from "@/components/ads/ad-location-slot";
import { ModPurchaseButton } from "@/components/mods/mod-purchase-button";
import { ModSecurityPanel } from "@/components/security/mod-security-panel";
import { formatCreditsFromCents } from "@/lib/credits";
import type { Locale } from "@/i18n/config";
import { serializeModVersions } from "@/lib/file-size";

export async function generateMetadata({
  params: { slug },
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const mod = await getModBySlug(slug);
  if (!mod) return { title: "Mod not found" };
  const media = mapModMedia(mod.media ?? []);
  const cover = getFeaturedMediaUrl(media, mod.screenshots);
  return {
    title: mod.title,
    description: mod.shortDescription ?? mod.description.slice(0, 160),
    openGraph: {
      title: `${mod.title} | ${SITE.name}`,
      description: mod.shortDescription ?? undefined,
      ...(cover ? { images: [{ url: cover }] } : {}),
    },
  };
}

export default async function ModDetailPage({
  params: { locale, slug },
}: {
  params: { locale: Locale; slug: string };
}) {
  setRequestLocale(locale);
  const t = await getTranslations("mods");
  const mod = await getModBySlug(slug);
  if (!mod || mod.status !== "PUBLISHED") notFound();

  const localized = await getLocalizedModContent(mod.id, locale, {
    title: mod.title,
    description: mod.description,
    shortDescription: mod.shortDescription,
  });

  const user = await getCurrentUser();
  const media = mapModMedia(mod.media ?? []);
  const featuredUrl = getFeaturedMediaUrl(media, mod.screenshots);
  const featuredImage = media.find((m) => m.isFeatured && m.mediaType === "IMAGE");
  const featuredVideo = media.find((m) => m.isFeatured && m.mediaType === "YOUTUBE");
  const videos = getYouTubeVideos(media);
  const galleryImages = getGalleryImages(media);

  const heroVideoId =
    featuredVideo?.youtubeVideoId ??
    (galleryImages.length === 0 && videos[0]?.youtubeVideoId ? videos[0].youtubeVideoId : null);
  const heroIsVideo = !!heroVideoId && !featuredImage?.imageUrl;
  const heroImageUrl = featuredUrl;

  const reviewUserIds = mod.reviews.map((r) => r.userId);
  const authorId = mod.author.id;

  const [favorited, related, badgeMap, owned, depCheck] = await Promise.all([
    user
      ? prisma.modFavorite.findUnique({
          where: { modId_userId: { modId: mod.id, userId: user.id } },
        })
      : null,
    getTrendingMods(4, mod.gameId),
    getInlineBadgesForUsers([authorId, ...reviewUserIds], locale),
    user
      ? prisma.modPurchase
          .findUnique({
            where: { modId_userId: { modId: mod.id, userId: user.id } },
          })
          .catch(() => null)
      : null,
    checkMissingDependencies(mod.id, user?.id ?? null),
  ]);

  const relatedMods = related.filter((m) => m.id !== mod.id).slice(0, 4);
  const creatorSlug = mod.author.creatorProfile?.slug ?? mod.author.username;
  const creatorBadges = badgeMap.get(authorId) ?? [];
  const primaryVersion = mod.versions.find((v) => v.isPrimary && !v.isArchived) ?? mod.versions[0];
  const securityStatus = primaryVersion?.scanStatus ?? "PENDING";
  const securityScannedAt = primaryVersion?.scannedAt;
  const isTrustedFile = !!(primaryVersion as { trustedFile?: { id: string } | null })?.trustedFile;

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <AdLocationSlot location="mod-detail" className="mb-6" />
      <div className="grid gap-8 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-8">
          <ModDetailMedia
            title={localized.title}
            media={media}
            featuredUrl={heroIsVideo ? featuredUrl : heroImageUrl}
            featuredIsVideo={heroIsVideo}
            featuredVideoId={heroVideoId}
            excludeVideoId={heroIsVideo ? heroVideoId : null}
          />

          <div className="glass rounded-xl border border-border/50 p-6">
            <div className="flex flex-wrap gap-2 mb-3">
              <Badge variant={mod.pricing === "FREE" ? "free" : "premium"}>{mod.pricing}</Badge>
              {mod.category && <Badge variant="outline">{mod.category.name}</Badge>}
              <span className="text-sm text-neon-blue">{mod.game.name}</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">{localized.title}</h1>
            {localized.shortDescription && (
              <p className="mt-2 text-muted-foreground">{localized.shortDescription}</p>
            )}
            <p className="mt-4 text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {localized.description}
            </p>
          </div>

          <ModVersionsPanel modId={mod.id} versions={serializeModVersions(mod.versions)} />

          <ModDependenciesPanel
            locale={locale}
            required={depCheck.required}
            optional={depCheck.optional}
            missing={depCheck.missing}
          />

          <Card className="glass">
            <CardHeader><CardTitle>{t("reviews")}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {user && <ReviewForm modId={mod.id} />}
              {mod.reviews.length === 0 ? (
                <p className="text-sm text-muted-foreground">No reviews yet.</p>
              ) : (
                mod.reviews.map((r) => (
                  <div key={r.id} className="border-b border-border/30 pb-4 last:border-0">
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 fill-neon-purple text-neon-purple" />
                      <span className="font-medium">{r.rating}/5</span>
                      <UserIdentity
                        username={r.user.username}
                        displayName={r.user.displayName}
                        badges={badgeMap.get(r.user.id) ?? []}
                        size="sm"
                      />
                    </div>
                    {r.content && <p className="mt-2 text-sm">{r.content}</p>}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-4 lg:sticky lg:top-24 lg:h-fit">
          <AdLocationSlot location="sidebar" />
          <Card className="glass border-neon-purple/20 p-6 shadow-[0_0_30px_-8px_rgba(168,85,247,0.2)]">
            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
              <span className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-neon-purple text-neon-purple" />
                {mod.averageRating.toFixed(1)}
              </span>
              <span className="flex items-center gap-1">
                <Download className="h-4 w-4" /> {mod.downloadCount.toLocaleString()}
              </span>
            </div>
            <div className="flex gap-2">
              <ModDownloadButton modId={mod.id} label={t("download")} />
              <FavoriteButton modId={mod.id} initialFavorited={!!favorited} />
            </div>
            {mod.pricing === "PAID" && mod.priceCents && mod.priceCents > 0 && user && (
              <ModPurchaseButton
                modId={mod.id}
                priceCents={mod.priceCents}
                owned={!!owned}
                locale={locale}
              />
            )}
            {mod.pricing === "PAID" && mod.priceCents && mod.priceCents > 0 && !user && (
              <p className="text-sm text-center mt-2 text-neon-purple font-medium">
                {formatCreditsFromCents(mod.priceCents, locale)}
              </p>
            )}
            {!user && mod.pricing !== "FREE" && (
              <p className="mt-3 text-xs text-muted-foreground text-center">
                <Link href={`/${locale}/login`} className="text-neon-purple hover:underline">
                  Sign in
                </Link>{" "}
                for premium mods
              </p>
            )}

            <div className="mt-6 border-t border-border/30 pt-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Creator</p>
              <Link
                href={`/${locale}/creators/${creatorSlug}`}
                className="flex items-center gap-3 rounded-lg p-2 -mx-2 hover:bg-accent/10 transition-colors"
              >
                <div className="relative h-10 w-10 shrink-0 rounded-full overflow-hidden">
                  <SafeImage src={mod.author.avatarUrl} alt="" fill className="object-cover" sizes="40px" />
                </div>
                <UserIdentity
                  username={mod.author.username}
                  displayName={mod.author.displayName}
                  badges={creatorBadges}
                />
              </Link>
            </div>

            <div className="mt-4 flex flex-wrap gap-1.5">
              {mod.tags.map((tag) => (
                <Badge key={tag.id} variant="outline">{tag.name}</Badge>
              ))}
            </div>

            <div className="mt-4">
              <ModSecurityPanel
                scanStatus={securityStatus}
                scannedAt={securityScannedAt}
                isTrusted={isTrustedFile}
              />
            </div>
          </Card>
        </div>
      </div>

      {relatedMods.length > 0 && (
        <section className="mt-12">
          <h2 className="text-lg font-semibold mb-4">Related mods</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {relatedMods.map((m) => (
              <ModCard key={m.id} locale={locale} mod={m} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
