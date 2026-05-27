"use client";

import { SafeImage } from "@/components/ui/safe-image";
import { Play } from "lucide-react";
import { ModGallery } from "@/components/mods/mod-gallery";
import { YouTubeEmbed } from "@/components/mods/youtube-embed";
import type { ModMediaItem } from "@/lib/mod-media";
import { getGalleryImages, getYouTubeVideos } from "@/lib/mod-media";

type ModDetailMediaProps = {
  title: string;
  media: ModMediaItem[];
  featuredUrl: string | null;
  featuredIsVideo: boolean;
  featuredVideoId: string | null;
  excludeVideoId?: string | null;
};

export function ModDetailMedia({
  title,
  media,
  featuredUrl,
  featuredIsVideo,
  featuredVideoId,
  excludeVideoId,
}: ModDetailMediaProps) {
  const galleryImages = getGalleryImages(media);
  const videos = getYouTubeVideos(media).filter(
    (v) => v.youtubeVideoId && v.youtubeVideoId !== excludeVideoId
  );

  return (
    <div className="space-y-8">
      <div className="relative aspect-video overflow-hidden rounded-xl border border-border/50 bg-gradient-to-br from-neon-purple/20 via-background to-neon-blue/10 shadow-[0_0_40px_-12px_rgba(168,85,247,0.25)]">
        {featuredIsVideo && featuredVideoId ? (
          <YouTubeEmbed videoId={featuredVideoId} title={title} priority />
        ) : featuredUrl ? (
          <SafeImage
            src={featuredUrl}
            alt={title}
            fill
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 66vw"
            priority
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            No media
          </div>
        )}
        {featuredIsVideo && featuredUrl && !featuredVideoId && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Play className="h-12 w-12 text-white/80" />
          </div>
        )}
      </div>

      {galleryImages.length > 0 && <ModGallery images={galleryImages} title={title} />}

      {videos.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Videos</h2>
          <div className="space-y-4">
            {videos.map((v) =>
              v.youtubeVideoId ? (
                <YouTubeEmbed key={v.id} videoId={v.youtubeVideoId} title={title} />
              ) : null
            )}
          </div>
        </section>
      )}
    </div>
  );
}
