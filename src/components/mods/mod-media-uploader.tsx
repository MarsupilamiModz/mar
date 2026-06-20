"use client";

import {
  addModYouTubeVideo,
  deleteModMedia,
  reorderModMedia,
  setFeaturedModMedia,
} from "@/actions/mod-media";
import Image from "next/image";
import { SafeImage } from "@/components/ui/safe-image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  GripVertical,
  ImagePlus,
  Loader2,
  Play,
  Star,
  Trash2,
  Upload,
  Youtube,
} from "lucide-react";
import { uploadViaApi } from "@/lib/upload-client";
import { formatUploadErrorMessage } from "@/lib/upload-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAppToast } from "@/hooks/use-app-toast";
import { compressImage, validateImageFile } from "@/lib/image-compress";
import { getMediaDisplayUrl, type ModMediaItem } from "@/lib/mod-media";
import { getScreenshotUrl } from "@/lib/screenshot-url";
import { cn } from "@/lib/utils";
import type { MediaSettings } from "@/lib/media-settings";

type ModMediaUploaderProps = {
  modId: string;
  media: ModMediaItem[];
  settings: MediaSettings;
};

type PendingFile = {
  id: string;
  file: File;
  preview: string;
  progress: number;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
};

export function ModMediaUploader({ modId, media: initialMedia, settings }: ModMediaUploaderProps) {
  const router = useRouter();
  const appToast = useAppToast();
  const [pending, startTransition] = useTransition();
  const [media, setMedia] = useState(initialMedia);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    setMedia(initialMedia);
  }, [initialMedia]);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const imageCount = media.filter((m) => m.mediaType === "IMAGE").length;
  const canAddMore = imageCount + pendingFiles.length < settings.maxScreenshots;

  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (arr.length === 0) return;

      const remaining = settings.maxScreenshots - imageCount - pendingFiles.length;
      const toProcess = arr.slice(0, remaining);

      const newPending: PendingFile[] = [];
      for (const file of toProcess) {
        const err = validateImageFile(file, settings.allowedTypes, settings.maxFileSizeMb);
        if (err) {
          appToast.error(err);
          continue;
        }
        try {
          const compressed = await compressImage(file, settings.imageQuality);
          newPending.push({
            id: `pending-${Date.now()}-${Math.random()}`,
            file: compressed,
            preview: URL.createObjectURL(compressed),
            progress: 0,
            status: "pending",
          });
        } catch {
          appToast.error(`Failed to process ${file.name}`);
        }
      }
      if (newPending.length) setPendingFiles((p) => [...p, ...newPending]);
    },
    [appToast, imageCount, pendingFiles.length, settings]
  );

  const uploadPending = async () => {
    const toUpload = pendingFiles.filter((p) => p.status === "pending" || p.status === "error");
    if (toUpload.length === 0) return;

    for (const item of toUpload) {
      setPendingFiles((prev) =>
        prev.map((p) => (p.id === item.id ? { ...p, status: "uploading", progress: 0 } : p))
      );

      try {
        const result = await uploadViaApi({
          file: item.file,
          purpose: "mod-screenshot",
          modId,
          onProgress: (progress) => {
            setPendingFiles((prev) =>
              prev.map((p) => (p.id === item.id ? { ...p, progress } : p))
            );
          },
        });

        if (result.mediaId && result.url) {
          const imageUrl = getScreenshotUrl(result.url) ?? result.url;
          setMedia((prev) => {
            const hasFeatured = prev.some((m) => m.isFeatured && m.mediaType === "IMAGE");
            return [
              ...prev,
              {
                id: result.mediaId!,
                mediaType: "IMAGE" as const,
                imageUrl,
                videoUrl: null,
                youtubeVideoId: null,
                orderIndex: prev.length,
                isFeatured: !hasFeatured,
              },
            ];
          });
        }

        URL.revokeObjectURL(item.preview);
        setPendingFiles((prev) => prev.filter((p) => p.id !== item.id));
      } catch (err) {
        const message = formatUploadErrorMessage(err);
        setPendingFiles((prev) =>
          prev.map((p) =>
            p.id === item.id ? { ...p, status: "error", error: message, progress: 0 } : p
          )
        );
        appToast.error(message);
        return;
      }
    }

    appToast.uploaded();
    router.refresh();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) processFiles(e.dataTransfer.files);
  };

  const handleReorder = (fromId: string, toId: string) => {
    const imageMedia = media.filter((m) => m.mediaType === "IMAGE");
    const fromIdx = imageMedia.findIndex((m) => m.id === fromId);
    const toIdx = imageMedia.findIndex((m) => m.id === toId);
    if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;

    const reordered = [...imageMedia];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);

    const otherMedia = media.filter((m) => m.mediaType !== "IMAGE");
    const newOrder = [...reordered, ...otherMedia].map((m, i) => ({ ...m, orderIndex: i }));
    setMedia(newOrder);

    startTransition(async () => {
      const r = await reorderModMedia(
        modId,
        newOrder.map((m) => m.id)
      );
      if (r.success) router.refresh();
      else appToast.error(r.error);
    });
  };

  const imageMedia = media.filter((m) => m.mediaType === "IMAGE");
  const videoMedia = media.filter((m) => m.mediaType === "YOUTUBE");

  return (
    <div className="space-y-6">
      <Card className="glass space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-medium flex items-center gap-2">
            <ImagePlus className="h-4 w-4 text-neon-purple" />
            Screenshots
          </h3>
          <span className="text-xs text-muted-foreground">
            {imageCount}/{settings.maxScreenshots}
          </span>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => canAddMore && fileInputRef.current?.click()}
          className={cn(
            "relative cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all",
            dragOver
              ? "border-neon-purple bg-neon-purple/10"
              : "border-border/50 hover:border-neon-purple/40 hover:bg-accent/5",
            !canAddMore && "pointer-events-none opacity-50"
          )}
        >
          <Upload className="mx-auto h-8 w-8 text-neon-purple/70" />
          <p className="mt-2 text-sm font-medium">Drag & drop screenshots here</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {settings.allowedTypes.map((t) => t.split("/")[1]).join(", ")} · Max {settings.maxFileSizeMb}MB
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept={settings.allowedTypes.join(",")}
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) processFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {pendingFiles.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Preview before upload</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {pendingFiles.map((p) => (
                <div key={p.id} className="relative aspect-video overflow-hidden rounded-lg border border-border/50">
                  <Image src={p.preview} alt="" fill className="object-cover" sizes="120px" unoptimized />
                  {p.status === "uploading" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                      <Loader2 className="h-5 w-5 animate-spin text-neon-purple" />
                    </div>
                  )}
                  {p.status === "error" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-destructive/20 p-1">
                      <p className="text-[10px] text-destructive">{p.error}</p>
                    </div>
                  )}
                  <button
                    type="button"
                    className="absolute right-1 top-1 rounded bg-background/80 p-1"
                    onClick={() => {
                      URL.revokeObjectURL(p.preview);
                      setPendingFiles((prev) => prev.filter((x) => x.id !== p.id));
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            <Button
              variant="neon"
              size="sm"
              onClick={() => startTransition(() => void uploadPending())}
              disabled={pending || pendingFiles.every((p) => p.status === "uploading")}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Upload {pendingFiles.length} screenshot{pendingFiles.length !== 1 ? "s" : ""}
            </Button>
          </div>
        )}

        {imageMedia.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {imageMedia.map((item) => (
              <div
                key={item.id}
                draggable
                onDragStart={() => setDragId(item.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => dragId && handleReorder(dragId, item.id)}
                onDragEnd={() => setDragId(null)}
                className={cn(
                  "group relative aspect-video cursor-grab overflow-hidden rounded-lg border border-border/50",
                  "transition-all hover:border-neon-purple/40 active:cursor-grabbing",
                  item.isFeatured && "ring-2 ring-neon-purple/60"
                )}
              >
                <SafeImage
                  src={item.imageUrl}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="150px"
                />
                <div className="absolute inset-0 flex items-start justify-between bg-gradient-to-b from-background/60 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <div className="flex gap-1">
                    {!item.isFeatured && (
                      <button
                        type="button"
                        title="Set as featured"
                        className="rounded bg-background/80 p-1 hover:text-neon-purple"
                        onClick={() =>
                          startTransition(async () => {
                            const r = await setFeaturedModMedia(item.id);
                            if (r.success) {
                              appToast.saved("Featured thumbnail set");
                              router.refresh();
                            } else appToast.error(r.error);
                          })
                        }
                      >
                        <Star className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      className="rounded bg-background/80 p-1 hover:text-destructive"
                      onClick={() =>
                        startTransition(async () => {
                          const r = await deleteModMedia(item.id);
                          if (r.success) {
                            setMedia((m) => m.filter((x) => x.id !== item.id));
                            router.refresh();
                          } else appToast.error(r.error);
                        })
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                {item.isFeatured && (
                  <Badge className="absolute bottom-1.5 left-1.5 text-[10px] bg-neon-purple/90">
                    Featured
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="glass space-y-4 p-6">
        <h3 className="font-medium flex items-center gap-2">
          <Youtube className="h-4 w-4 text-red-400" />
          YouTube Video
        </h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const r = await addModYouTubeVideo(modId, new FormData(e.currentTarget));
              if (r.success) {
                appToast.uploaded();
                (e.target as HTMLFormElement).reset();
                router.refresh();
              } else appToast.error(r.error);
            });
          }}
          className="flex flex-col gap-2 sm:flex-row"
        >
          <Input
            name="url"
            placeholder="https://youtube.com/watch?v=... or youtu.be/..."
            required
            className="flex-1"
          />
          <Button type="submit" variant="outline" disabled={pending}>
            Add Video
          </Button>
        </form>

        {videoMedia.length > 0 && (
          <div className="space-y-2">
            {videoMedia.map((v) => {
              const thumb = getMediaDisplayUrl(v);
              return (
                <div
                  key={v.id}
                  className="flex items-center gap-3 rounded-lg border border-border/50 p-2"
                >
                  {thumb && (
                    <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded">
                      <SafeImage src={thumb} alt="" fill className="object-cover" sizes="80px" />
                      <Play className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow" />
                    </div>
                  )}
                  <p className="flex-1 truncate text-xs text-muted-foreground">{v.videoUrl}</p>
                  <button
                    type="button"
                    className="rounded p-1 hover:text-destructive"
                    onClick={() =>
                      startTransition(async () => {
                        const r = await deleteModMedia(v.id);
                        if (r.success) router.refresh();
                        else appToast.error(r.error);
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
