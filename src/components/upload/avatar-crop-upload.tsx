"use client";

import { useCallback, useState } from "react";
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
import { getCroppedImageBlob } from "@/lib/crop-image";
import { cn } from "@/lib/utils";

type AvatarCropUploadProps = {
  label: string;
  onCropped: (file: File) => Promise<void>;
  aspect?: number;
  className?: string;
  disabled?: boolean;
};

export function AvatarCropUpload({
  label,
  onCropped,
  aspect = 1,
  className,
  disabled,
}: AvatarCropUploadProps) {
  const [open, setOpen] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);
  const [fileName, setFileName] = useState("avatar.jpg");
  const [rotation, setRotation] = useState(0);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedArea(pixels);
  }, []);

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setFileName(file.name.replace(/\.[^.]+$/, ".jpg"));
    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setRotation(0);
      setOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (!imageSrc || !croppedArea) return;
    setSaving(true);
    try {
      const blob = await getCroppedImageBlob(imageSrc, croppedArea, 512, "image/jpeg", rotation);
      const file = new File([blob], fileName, { type: "image/jpeg" });
      await onCropped(file);
      setOpen(false);
      setImageSrc(null);
    } finally {
      setSaving(false);
    }
  };

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
        <DialogContent className="glass max-w-md border-neon-purple/30" data-snake-trigger>
          <DialogHeader>
            <DialogTitle>Crop profile image</DialogTitle>
          </DialogHeader>
          <div className="relative h-64 w-full rounded-xl overflow-hidden bg-black/60 border border-border/40">
            {imageSrc && (
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                rotation={rotation}
                aspect={aspect}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onRotationChange={setRotation}
                onCropComplete={onCropComplete}
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
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="neon" onClick={() => void save()} disabled={saving || !croppedArea}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Save avatar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
