"use client";

import { useState } from "react";
import Image from "next/image";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveAssetUrl } from "@/lib/assets";

type SafeImageProps = {
  src: string | null | undefined;
  alt: string;
  fill?: boolean;
  width?: number;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
  sizes?: string;
  priority?: boolean;
  loading?: "lazy" | "eager";
};

function isLocalPreview(url: string) {
  return url.startsWith("blob:") || url.startsWith("data:");
}

export function SafeImage({
  src,
  alt,
  fill,
  width,
  height,
  className,
  style,
  sizes,
  priority,
  loading = "lazy",
}: SafeImageProps) {
  const [failed, setFailed] = useState(false);
  const resolved = resolveAssetUrl(src);

  if (!resolved || failed) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted/30 text-muted-foreground",
          fill && "absolute inset-0",
          className
        )}
        style={!fill && width && height ? { width, height } : undefined}
        aria-hidden={!alt}
      >
        <ImageOff className="h-8 w-8 opacity-40" />
      </div>
    );
  }

  const unoptimized = isLocalPreview(resolved);

  if (fill) {
    return (
      <Image
        src={resolved}
        alt={alt}
        fill
        className={className}
        style={style}
        sizes={sizes ?? "100vw"}
        priority={priority}
        loading={priority ? undefined : loading}
        placeholder="empty"
        unoptimized={unoptimized}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <Image
      src={resolved}
      alt={alt}
      width={width ?? 400}
      height={height ?? 300}
      className={className}
      sizes={sizes}
      priority={priority}
      loading={priority ? undefined : loading}
      placeholder="empty"
      unoptimized={unoptimized}
      onError={() => setFailed(true)}
    />
  );
}
