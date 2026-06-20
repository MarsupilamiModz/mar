"use client";

import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SafeImage } from "@/components/ui/safe-image";
import { AvatarCropUpload } from "@/components/upload/avatar-crop-upload";
import { useAppToast } from "@/hooks/use-app-toast";
import { uploadViaApi } from "@/lib/upload-client";
import { cn } from "@/lib/utils";

type Props = {
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  teamMemberId?: string;
  disabled?: boolean;
  onAvatarChange?: (url: string) => void;
  onBannerChange?: (url: string) => void;
};

export function TeamMemberMediaUpload({
  avatarUrl,
  bannerUrl,
  teamMemberId,
  disabled,
  onAvatarChange,
  onBannerChange,
}: Props) {
  const appToast = useAppToast();
  const bannerRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<"avatar" | "banner" | null>(null);
  const [progress, setProgress] = useState(0);

  async function handleUpload(file: File, purpose: "team-avatar" | "team-banner") {
    setUploading(purpose === "team-avatar" ? "avatar" : "banner");
    setProgress(0);
    try {
      const result = await uploadViaApi({
        file,
        purpose,
        teamMemberId,
        onProgress: setProgress,
      });
      if (purpose === "team-avatar") onAvatarChange?.(result.url);
      else onBannerChange?.(result.url);
      appToast.uploaded();
    } catch (err) {
      appToast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(null);
      setProgress(0);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <p className="text-sm font-medium">Avatar</p>
          <div className="relative mx-auto h-24 w-24 overflow-hidden rounded-full border border-border/50 bg-muted/30">
            <SafeImage src={avatarUrl} alt="" fill className="object-cover" sizes="96px" />
          </div>
          <AvatarCropUpload
            label="Upload avatar"
            disabled={disabled || uploading === "avatar"}
            onCropped={(file) => handleUpload(file, "team-avatar")}
          />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Banner</p>
          <div className="relative aspect-[3/1] overflow-hidden rounded-lg border border-border/50 bg-muted/30">
            <SafeImage src={bannerUrl} alt="" fill className="object-cover" sizes="320px" />
          </div>
          <input
            ref={bannerRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleUpload(file, "team-banner");
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            disabled={disabled || uploading === "banner"}
            onClick={() => bannerRef.current?.click()}
          >
            {uploading === "banner" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Upload banner
          </Button>
        </div>
      </div>

      {uploading && (
        <div className="space-y-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full bg-neon-purple transition-all duration-200")}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">Uploading… {progress}%</p>
        </div>
      )}
    </div>
  );
}
