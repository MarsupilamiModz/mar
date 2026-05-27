"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type YouTubeEmbedProps = {
  videoId: string;
  title?: string;
  className?: string;
  priority?: boolean;
};

export function YouTubeEmbed({ videoId, title = "YouTube video", className, priority }: YouTubeEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(priority ?? false);

  useEffect(() => {
    if (priority || visible) return;
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [priority, visible]);

  const embedSrc = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&color=white&playsinline=1`;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative aspect-video w-full overflow-hidden rounded-xl border border-border/50",
        "bg-gradient-to-br from-neon-purple/10 via-background to-neon-blue/10",
        "shadow-[inset_0_0_40px_rgba(168,85,247,0.08)]",
        className
      )}
    >
      {visible ? (
        <iframe
          src={embedSrc}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading={priority ? "eager" : "lazy"}
          className="absolute inset-0 h-full w-full border-0"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-14 w-14 rounded-full bg-neon-purple/20 backdrop-blur-sm border border-neon-purple/40 flex items-center justify-center">
            <div className="ml-1 h-0 w-0 border-y-[10px] border-y-transparent border-l-[16px] border-l-neon-purple" />
          </div>
        </div>
      )}
    </div>
  );
}
