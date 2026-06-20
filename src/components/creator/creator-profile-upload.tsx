"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SafeImage } from "@/components/ui/safe-image";
import { useAppToast } from "@/hooks/use-app-toast";
import { AvatarCropUpload } from "@/components/upload/avatar-crop-upload";
import { uploadViaApi } from "@/lib/upload-client";
import { getMediaUrl } from "@/lib/media-url";
import { cn } from "@/lib/utils";

type CreatorProfileUploadProps = {
  avatarUrl?: string | null;
  bannerUrl?: string | null;
};

export function CreatorProfileUpload({ avatarUrl, bannerUrl }: CreatorProfileUploadProps) {
  const t = useTranslations("media");
  const appToast = useAppToast();
  const router = useRouter();
  const bannerRef = useRef<HTMLInputElement>(null);
  const [avatar, setAvatar] = useState(avatarUrl);
  const [banner, setBanner] = useState(bannerUrl);
  const [uploading, setUploading] = useState<"avatar" | "banner" | null>(null);
  const [progress, setProgress] = useState(0);

  async function handleUpload(file: File, purpose: "creator-avatar" | "creator-banner") {
    setUploading(purpose === "creator-avatar" ? "avatar" : "banner");
    setProgress(0);
    try {
      const result = await uploadViaApi({
        file,
        purpose,
        onProgress: setProgress,
      });
      const url = getMediaUrl(result.url) ?? result.url;
      if (purpose === "creator-avatar") setAvatar(url);
      else setBanner(url);
      appToast.uploaded();
      router.refresh();
    } catch (err) {
      appToast.error(err instanceof Error ? err.message : t("uploadFailed"));
    } finally {
      setUploading(null);
      setProgress(0);
    }
  }

  return (
    <Card className="glass space-y-4 p-6">
      <h3 className="font-medium">{t("profileMedia")}</h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{t("avatar")}</p>
          <div className="relative mx-auto h-24 w-24 overflow-hidden rounded-full border border-border/50">
            <SafeImage
              src={avatar}
              alt=""
              fill
              className="object-cover"
              sizes="96px"
              fallbackLabel=""
            />
          </div>
          <AvatarCropUpload
            label={t("uploadAvatar")}
            disabled={uploading === "avatar"}
            onCropped={(file) => handleUpload(file, "creator-avatar")}
          />
        </div>

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{t("banner")}</p>
          <div className="relative aspect-[3/1] overflow-hidden rounded-lg border border-border/50 bg-gradient-to-r from-neon-purple/10 to-neon-blue/10">
            <SafeImage
              src={banner}
              alt=""
              fill
              className="object-cover"
              sizes="300px"
              fallbackLabel=""
            />
          </div>
          <input
            ref={bannerRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleUpload(file, "creator-banner");
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            disabled={uploading === "banner"}
            onClick={() => bannerRef.current?.click()}
          >
            {uploading === "banner" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {t("uploadBanner")}
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
          <p className="text-xs text-muted-foreground">{t("uploading", { progress })}</p>
        </div>
      )}
    </Card>
  );
}
