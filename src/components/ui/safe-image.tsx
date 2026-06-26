"use client";

import { useState } from "react";
import Image from "next/image";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { getMediaUrl, getMediaProxyFallback } from "@/lib/media-url";

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
  fallbackLabel?: string;
};

function isLocalPreview(url: string) {
  return url.startsWith("blob:") || url.startsWith("data:");
}

function shouldUseUnoptimized(url: string): boolean {
  if (isLocalPreview(url)) return true;
  // External/CDN URLs — bypass Next Image optimizer (avoids remotePatterns 403 loops).
  return url.startsWith("http://") || url.startsWith("https://");
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
  fallbackLabel = "No image available",
}: SafeImageProps) {
  const [failed, setFailed] = useState(false);
  const [useProxy, setUseProxy] = useState(false);

  useEffect(() => {
    setFailed(false);
    setUseProxy(false);
  }, [src]);

  const primary = getMediaUrl(src);
  const proxy = useProxy ? getMediaProxyFallback(src) : null;
  const resolved = proxy ?? primary;

  if (!resolved || failed) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-1 bg-muted/30 text-muted-foreground",
          fill && "absolute inset-0",
          className
        )}
        style={!fill && width && height ? { width, height } : undefined}
        aria-hidden={!alt}
      >
        <ImageOff className="h-8 w-8 opacity-40" />
        {fallbackLabel && (
          <span className="text-[10px] opacity-60 px-2 text-center">{fallbackLabel}</span>
        )}
      </div>
    );
  }

  const unoptimized = shouldUseUnoptimized(resolved);

  const handleError = () => {
    if (!useProxy && getMediaProxyFallback(src)) {
      setUseProxy(true);
      return;
    }
    setFailed(true);
    if (process.env.NODE_ENV === "development") {
      console.warn("[SafeImage] failed to load", { src, resolved });
    }
  };

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
        onError={handleError}
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
      onError={handleError}
    />
  );
}
