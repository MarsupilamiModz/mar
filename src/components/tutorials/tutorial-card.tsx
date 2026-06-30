import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatTutorialDuration } from "@/lib/tutorials/youtube";

type Tutorial = {
  slug: string;
  title: string;
  description: string | null;
  type: string;
  level: string;
  viewCount: number;
  likeCount: number;
  youtubeThumbnail: string | null;
  videoThumbUrl: string | null;
  youtubeDurationSec: number | null;
  videoDurationSec: number | null;
  category: { name: string } | null;
};

export function TutorialCard({ locale, tutorial }: { locale: string; tutorial: Tutorial }) {
  const thumb = tutorial.youtubeThumbnail ?? tutorial.videoThumbUrl;
  const duration = formatTutorialDuration(
    tutorial.youtubeDurationSec ?? tutorial.videoDurationSec
  );

  return (
    <Link href={`/${locale}/tutorials/${tutorial.slug}`}>
      <Card className="card-surface h-full overflow-hidden transition-colors hover:border-neon-purple/30">
        {thumb ? (
          <div className="relative aspect-video bg-muted/30">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumb} alt="" className="h-full w-full object-cover" />
            {duration ? (
              <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-xs">
                {duration}
              </span>
            ) : null}
          </div>
        ) : null}
        <CardContent className="p-4 space-y-2">
          <div className="flex flex-wrap gap-1">
            {tutorial.category ? (
              <Badge variant="outline" className="text-xs">
                {tutorial.category.name}
              </Badge>
            ) : null}
            <Badge variant="secondary" className="text-xs">
              {tutorial.type}
            </Badge>
          </div>
          <h2 className="font-semibold leading-snug line-clamp-2">{tutorial.title}</h2>
          {tutorial.description ? (
            <p className="text-sm text-muted-foreground line-clamp-2">{tutorial.description}</p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {tutorial.viewCount} views · {tutorial.likeCount} likes
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
