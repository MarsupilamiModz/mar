import {
  Crown,
  Flame,
  Gamepad2,
  Rocket,
  Shield,
  Sparkles,
  Star,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SafeImage } from "@/components/ui/safe-image";
import type { BrandingAssetSettings } from "@/lib/branding-cms";

const LIBRARY_ICONS = {
  sparkles: Sparkles,
  crown: Crown,
  gamepad: Gamepad2,
  zap: Zap,
  star: Star,
  flame: Flame,
  shield: Shield,
  rocket: Rocket,
} as const;

export type LogoBranding = Pick<
  BrandingAssetSettings,
  | "siteTitle"
  | "siteShortName"
  | "logoUrl"
  | "siteSymbolMode"
  | "siteSymbolLetter"
  | "siteSymbolUrl"
  | "siteSymbolLibrary"
  | "siteSymbolColor"
  | "logoObjectPosition"
>;

export function Logo({
  className,
  showText = true,
  size = "md",
  branding,
}: {
  className?: string;
  showText?: boolean;
  size?: "sm" | "md" | "lg";
  branding?: LogoBranding | null;
}) {
  const sizes = {
    sm: { box: "h-7 w-7 text-sm", text: "text-sm" },
    md: { box: "h-9 w-9 text-base", text: "text-base" },
    lg: { box: "h-12 w-12 text-xl", text: "text-xl" },
  };
  const title = branding?.siteTitle ?? "Xumari Modz";
  const short = branding?.siteShortName ?? title;

  const symbolContent = () => {
    if (branding?.logoUrl) {
      return (
        <span className={cn("relative block shrink-0 overflow-hidden rounded-lg", sizes[size].box)}>
          <SafeImage
            src={branding.logoUrl}
            alt={title}
            fill
            className="object-contain"
            style={{ objectPosition: branding.logoObjectPosition ?? "center" }}
            sizes="48px"
          />
        </span>
      );
    }

    if (branding?.siteSymbolMode === "image" && branding.siteSymbolUrl) {
      return (
        <span className={cn("relative block shrink-0 overflow-hidden rounded-lg", sizes[size].box)}>
          <SafeImage src={branding.siteSymbolUrl} alt="" fill className="object-contain" sizes="48px" />
        </span>
      );
    }

    if (branding?.siteSymbolMode === "library" && branding.siteSymbolLibrary) {
      const Icon = LIBRARY_ICONS[branding.siteSymbolLibrary as keyof typeof LIBRARY_ICONS] ?? Sparkles;
      return (
        <span
          className={cn(
            "flex items-center justify-center rounded-lg font-black text-white shadow-neon shrink-0",
            sizes[size].box
          )}
          style={{
            background: `linear-gradient(135deg, ${branding.siteSymbolColor}, ${branding.siteSymbolColor}99)`,
          }}
        >
          <Icon className="h-[55%] w-[55%]" aria-hidden />
        </span>
      );
    }

    const letter = branding?.siteSymbolLetter?.slice(0, 1) ?? "X";
    const color = branding?.siteSymbolColor ?? "#a855f7";
    return (
      <span
        className={cn(
          "flex items-center justify-center rounded-lg font-black text-white shadow-neon shrink-0",
          sizes[size].box
        )}
        style={{ background: `linear-gradient(135deg, ${color}, ${color}99)` }}
        aria-hidden
      >
        {letter}
      </span>
    );
  };

  return (
    <span className={cn("inline-flex items-center gap-2 font-bold", className)}>
      {symbolContent()}
      {showText && (
        <span className={cn("bg-gradient-to-r from-neon-purple to-neon-blue bg-clip-text text-transparent", sizes[size].text)}>
          {size === "sm" ? short : title}
        </span>
      )}
    </span>
  );
}
