"use client";

import { useCallback, useMemo, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Loader2, RotateCw, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SafeImage } from "@/components/ui/safe-image";
import { getCroppedImageBlob } from "@/lib/crop-image";
import { cn } from "@/lib/utils";

const ASPECT_PRESETS = {
  square: { label: "Square", aspect: 1, output: { width: 640, height: 640 } },
  portrait: { label: "Portrait", aspect: 3 / 4, output: { width: 480, height: 640 } },
  landscape: { label: "Landscape", aspect: 16 / 9, output: { width: 640, height: 360 } },
} as const;

type AspectPreset = keyof typeof ASPECT_PRESETS;

type CategoryImageCropUploadProps = {
  label: string;
  categoryName?: string;
  modCount?: number;
  onCropped: (file: File) => Promise<void>;
  className?: string;
  disabled?: boolean;
};

export function CategoryImageCropUpload({
  label,
  categoryName = "Category",
  modCount = 0,
  onCropped,
  className,
  disabled,
}: CategoryImageCropUploadProps) {
  const [open, setOpen] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [preset, setPreset] = useState<AspectPreset>("square");

  const aspectConfig = ASPECT_PRESETS[preset];

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedArea(pixels);
  }, []);

  const updatePreview = useCallback(
    async (src: string, area: Area, currentPreset: AspectPreset, rot: number) => {
      try {
        const blob = await getCroppedImageBlob(
          src,
          area,
          ASPECT_PRESETS[currentPreset].output,
          "image/webp",
          rot
        );
        const url = URL.createObjectURL(blob);
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      } catch {
        setPreviewUrl(null);
      }
    },
    []
  );

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setRotation(0);
      setPreset("square");
      setPreviewUrl(null);
      setOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (!imageSrc || !croppedArea) return;
    setSaving(true);
    try {
      const blob = await getCroppedImageBlob(
        imageSrc,
        croppedArea,
        aspectConfig.output,
        "image/webp",
        rotation
      );
      const file = new File([blob], "category.webp", { type: "image/webp" });
      await onCropped(file);
      setOpen(false);
      setImageSrc(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    } finally {
      setSaving(false);
    }
  };

  const previewCard = useMemo(
    () => (
      <div className="rounded-xl border border-border/40 bg-background/30 p-3 space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">Card preview</p>
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border/40 p-3 hover:border-neon-purple/30 transition-colors">
          <div className="relative h-32 w-32 overflow-hidden rounded-xl border border-border/50 bg-muted/30">
            {previewUrl ? (
              <SafeImage src={previewUrl} alt="" fill className="object-cover" sizes="128px" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                Preview
              </div>
            )}
          </div>
          <div className="text-center">
            <p className="font-medium text-sm">{categoryName}</p>
            <p className="text-xs text-neon-blue">{modCount} mods</p>
          </div>
        </div>
      </div>
    ),
    [categoryName, modCount, previewUrl]
  );

  return (
    <>
      <label className={cn("inline-block", className)}>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={disabled || saving}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
        <Button type="button" variant="outline" size="sm" disabled={disabled || saving} asChild>
          <span>{label}</span>
        </Button>
      </label>

      <Dialog open={open} onOpenChange={(v) => !saving && setOpen(v)}>
        <DialogContent className="glass max-w-3xl border-neon-purple/30">
          <DialogHeader>
            <DialogTitle>Crop category image</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-[1fr_220px]">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {(Object.keys(ASPECT_PRESETS) as AspectPreset[]).map((key) => (
                  <Button
                    key={key}
                    type="button"
                    size="sm"
                    variant={preset === key ? "neon" : "outline"}
                    onClick={() => setPreset(key)}
                  >
                    {ASPECT_PRESETS[key].label}
                  </Button>
                ))}
              </div>
              <div className="relative h-72 w-full rounded-xl overflow-hidden bg-black/60 border border-border/40">
                {imageSrc && (
                  <Cropper
                    image={imageSrc}
                    crop={crop}
                    zoom={zoom}
                    rotation={rotation}
                    aspect={aspectConfig.aspect}
                    cropShape="rect"
                    showGrid
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onRotationChange={setRotation}
                    onCropComplete={(a, pixels) => {
                      onCropComplete(a, pixels);
                      void updatePreview(imageSrc, pixels, preset, rotation);
                    }}
                  />
                )}
              </div>
              <div className="flex items-center gap-3 px-1">
                <ZoomIn className="h-4 w-4 text-muted-foreground shrink-0" />
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.05}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full accent-[#a855f7]"
                />
              </div>
              <div className="flex items-center gap-3 px-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                >
                  <RotateCw className="h-4 w-4 mr-1" />
                  Rotate
                </Button>
                <input
                  type="range"
                  min={0}
                  max={360}
                  step={1}
                  value={rotation}
                  onChange={(e) => setRotation(Number(e.target.value))}
                  className="w-full accent-[#a855f7]"
                />
              </div>
            </div>
            {previewCard}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="neon" onClick={() => void save()} disabled={saving || !croppedArea}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Save image
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
