"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SafeImage } from "@/components/ui/safe-image";
import { AvatarCropUpload } from "@/components/upload/avatar-crop-upload";
import { useAppToast } from "@/hooks/use-app-toast";
import { uploadViaApi, type UploadPurpose } from "@/lib/upload-client";
import { cn } from "@/lib/utils";

type StudioProfileUploadProps = {
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  logoUrl?: string | null;
  avatarPurpose: UploadPurpose;
  bannerPurpose?: UploadPurpose;
  logoPurpose?: UploadPurpose;
  showBanner?: boolean;
  showLogo?: boolean;
};

export function StudioProfileUpload({
  avatarUrl,
  bannerUrl,
  logoUrl,
  avatarPurpose,
  bannerPurpose,
  logoPurpose,
  showBanner = true,
  showLogo = false,
}: StudioProfileUploadProps) {
  const t = useTranslations("media");
  const appToast = useAppToast();
  const router = useRouter();
  const bannerRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<"banner" | "logo" | null>(null);
  const [progress, setProgress] = useState(0);

  async function handleUpload(file: File, purpose: UploadPurpose) {
    setUploading(purpose.includes("banner") ? "banner" : "logo");
    setProgress(0);
    try {
      await uploadViaApi({ file, purpose, onProgress: setProgress });
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
            <SafeImage src={avatarUrl} alt="" fill className="object-cover" sizes="96px" />
          </div>
          <AvatarCropUpload
            label={t("uploadAvatar")}
            onCropped={async (file) => {
              setProgress(0);
              try {
                await uploadViaApi({ file, purpose: avatarPurpose, onProgress: setProgress });
                appToast.uploaded();
                router.refresh();
              } catch (err) {
                appToast.error(err instanceof Error ? err.message : t("uploadFailed"));
              }
            }}
          />
        </div>

        {showBanner && bannerPurpose && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{t("banner")}</p>
            <div className="relative aspect-[3/1] overflow-hidden rounded-lg border border-border/50">
              <SafeImage src={bannerUrl} alt="" fill className="object-cover" sizes="300px" />
            </div>
            <input
              ref={bannerRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleUpload(file, bannerPurpose);
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
              {uploading === "banner" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {t("uploadBanner")}
            </Button>
          </div>
        )}

        {showLogo && logoPurpose && (
          <div className="space-y-2 sm:col-span-2">
            <p className="text-sm text-muted-foreground">Logo</p>
            <div className="relative mx-auto h-16 w-16 overflow-hidden rounded-xl border border-border/50">
              <SafeImage src={logoUrl} alt="" fill className="object-cover" sizes="64px" />
            </div>
            <input
              ref={logoRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleUpload(file, logoPurpose);
                e.target.value = "";
              }}
            />
            <Button type="button" variant="outline" size="sm" disabled={uploading === "logo"} onClick={() => logoRef.current?.click()}>
              Upload logo
            </Button>
          </div>
        )}
      </div>

      {uploading && (
        <div className="space-y-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className={cn("h-full bg-neon-purple transition-all duration-200")} style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}
    </Card>
  );
}
