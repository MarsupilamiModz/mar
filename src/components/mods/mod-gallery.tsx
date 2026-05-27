"use client";

import { useCallback, useEffect, useState } from "react";
import { SafeImage } from "@/components/ui/safe-image";
import { ChevronLeft, ChevronRight, Expand, X, ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

type GalleryImage = { id: string; url: string };

type ModGalleryProps = {
  images: GalleryImage[];
  title: string;
  className?: string;
};

export function ModGallery({ images, title, className }: ModGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const go = useCallback(
    (dir: -1 | 1) => {
      setActiveIndex((i) => (i + dir + images.length) % images.length);
      setZoomed(false);
    },
    [images.length]
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, go]);

  if (images.length === 0) return null;

  const active = images[activeIndex];

  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Gallery</h2>
        <span className="text-xs text-muted-foreground">{images.length} screenshots</span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {images.map((img, i) => (
          <button
            key={img.id}
            type="button"
            onClick={() => {
              setActiveIndex(i);
              setOpen(true);
            }}
            className={cn(
              "group relative aspect-video overflow-hidden rounded-lg border border-border/50",
              "transition-all duration-300 hover:border-neon-purple/50 hover:shadow-[0_0_20px_-4px_rgba(168,85,247,0.3)]",
              i === activeIndex && "ring-2 ring-neon-purple/60"
            )}
          >
            <SafeImage
              src={img.url}
              alt={`${title} screenshot ${i + 1}`}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 640px) 50vw, 25vw"
              loading="lazy"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-background/40 opacity-0 transition-opacity group-hover:opacity-100">
              <ZoomIn className="h-5 w-5 text-white drop-shadow" />
            </div>
          </button>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl border-border/50 bg-background/95 p-0 backdrop-blur-xl">
          <div className="relative">
            <div className="absolute right-3 top-3 z-20 flex gap-2">
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9 bg-background/60 backdrop-blur"
                onClick={() => setZoomed((z) => !z)}
              >
                <Expand className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9 bg-background/60 backdrop-blur"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div
              className="relative flex min-h-[50vh] items-center justify-center overflow-hidden bg-black/80 p-4"
              onTouchStart={(e) => setTouchStart(e.touches[0].clientX)}
              onTouchEnd={(e) => {
                if (touchStart === null) return;
                const diff = e.changedTouches[0].clientX - touchStart;
                if (Math.abs(diff) > 50) go(diff > 0 ? -1 : 1);
                setTouchStart(null);
              }}
            >
              <Button
                size="icon"
                variant="ghost"
                className="absolute left-2 z-10 h-10 w-10 bg-background/50 backdrop-blur"
                onClick={() => go(-1)}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>

              <div
                className={cn(
                  "relative max-h-[75vh] w-full max-w-4xl transition-transform duration-300",
                  zoomed ? "scale-125 cursor-zoom-out" : "cursor-zoom-in"
                )}
                onClick={() => setZoomed((z) => !z)}
              >
                <div className="relative aspect-video w-full">
                  <SafeImage
                    src={active.url}
                    alt={`${title} screenshot ${activeIndex + 1}`}
                    fill
                    className="object-contain"
                    sizes="90vw"
                    priority
                  />
                </div>
              </div>

              <Button
                size="icon"
                variant="ghost"
                className="absolute right-2 z-10 h-10 w-10 bg-background/50 backdrop-blur"
                onClick={() => go(1)}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex gap-2 overflow-x-auto border-t border-border/30 bg-background/80 p-3">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => {
                    setActiveIndex(i);
                    setZoomed(false);
                  }}
                  className={cn(
                    "relative h-14 w-20 shrink-0 overflow-hidden rounded-md border transition-all",
                    i === activeIndex
                      ? "border-neon-purple ring-1 ring-neon-purple/50"
                      : "border-border/40 opacity-70 hover:opacity-100"
                  )}
                >
                  <SafeImage src={img.url} alt="" fill className="object-cover" sizes="80px" />
                </button>
              ))}
            </div>

            <p className="px-4 py-2 text-center text-xs text-muted-foreground">
              {activeIndex + 1} / {images.length} — Arrow keys · Swipe · Click to zoom
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
