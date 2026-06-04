import { Badge } from "@/components/ui/badge";
import { SafeImage } from "@/components/ui/safe-image";
import {
  bannerImageStyle,
  resolveBannerHeight,
  type GameBannerConfig,
} from "@/lib/game-banner";

type GameHeroBannerProps = {
  name: string;
  description?: string | null;
  shortDescription?: string | null;
  iconUrl?: string | null;
  bannerUrl?: string | null;
  coverUrl?: string | null;
  isFeatured?: boolean;
  modCount: number;
  creatorCount: number;
  featuredLabel: string;
  modsLabel: string;
  creatorsLabel: string;
  banner: GameBannerConfig;
  gradientStyle?: React.CSSProperties;
};

export function GameHeroBanner({
  name,
  description,
  shortDescription,
  iconUrl,
  bannerUrl,
  coverUrl,
  isFeatured,
  modCount: _modCount,
  creatorCount: _creatorCount,
  featuredLabel,
  modsLabel,
  creatorsLabel,
  banner,
  gradientStyle,
}: GameHeroBannerProps) {
  const height = resolveBannerHeight(banner);
  const imageSrc = bannerUrl ?? coverUrl;
  const blurb = shortDescription ?? description;
  const imgStyle = bannerImageStyle(banner);

  return (
    <section
      className="relative border-b border-border/40 overflow-hidden"
      style={{ minHeight: height, ...gradientStyle }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-neon-purple/10 via-background/40 to-background" />
      {imageSrc && (
        <div className="absolute inset-0 overflow-hidden">
          <SafeImage
            src={imageSrc}
            alt=""
            fill
            className="object-cover opacity-30 sm:opacity-40"
            style={imgStyle}
            priority
            sizes="100vw"
          />
        </div>
      )}
      <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-16">
        <div className="flex flex-wrap items-end gap-4 sm:gap-6">
          {iconUrl ? (
            <div className="relative h-16 w-16 sm:h-24 sm:w-24 rounded-2xl overflow-hidden border border-neon-purple/30 shadow-neon shrink-0">
              <SafeImage src={iconUrl} alt={name} fill className="object-cover" sizes="96px" priority />
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            {isFeatured && (
              <Badge variant="premium" className="mb-2">
                {featuredLabel}
              </Badge>
            )}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gradient">{name}</h1>
            {blurb && (
              <p className="mt-2 max-w-2xl text-sm sm:text-base text-muted-foreground leading-relaxed">
                {blurb}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              <span className="text-neon-blue">{modsLabel}</span>
              <span className="text-neon-purple">{creatorsLabel}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
