"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatUploadErrorMessage } from "@/lib/upload-errors";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useR2MultipartUpload } from "@/hooks/use-r2-multipart-upload";
import { submitCreatorApplication } from "@/actions/applications";

export function CreatorApplicationForm({ userEmail }: { userEmail: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { upload, progress, uploading } = useR2MultipartUpload();
  const [portfolioImages, setPortfolioImages] = useState<string[]>([]);

  async function handlePortfolioUpload(file: File) {
    try {
      const result = await upload({ file, purpose: "creator-portfolio" });
      if (result.url) setPortfolioImages((prev) => [...prev, result.url as string]);
    } catch (err) {
      toast({ title: "Upload failed", description: formatUploadErrorMessage(err), variant: "destructive" });
    }
  }

  return (
    <Card className="glass max-w-2xl">
      <CardHeader>
        <CardTitle>Become a Creator</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(async () => {
              const r = await submitCreatorApplication({
                displayName: fd.get("displayName") as string,
                email: fd.get("email") as string,
                discord: (fd.get("discord") as string) || undefined,
                portfolioUrl: (fd.get("portfolioUrl") as string) || undefined,
                youtubeUrl: (fd.get("youtubeUrl") as string) || undefined,
                twitchUrl: (fd.get("twitchUrl") as string) || undefined,
                tiktokUrl: (fd.get("tiktokUrl") as string) || undefined,
                instagramUrl: (fd.get("instagramUrl") as string) || undefined,
                xUrl: (fd.get("xUrl") as string) || undefined,
                websiteUrl: (fd.get("websiteUrl") as string) || undefined,
                message: (fd.get("message") as string) || undefined,
                portfolioImages,
              });
              if (r.success) {
                toast({ title: "Application submitted" });
                router.refresh();
              } else toast({ title: r.error, variant: "destructive" });
            });
          }}
        >
          <Input name="displayName" placeholder="Display name" required />
          <Input name="email" type="email" defaultValue={userEmail} required />
          <Input name="discord" placeholder="Discord username" />
          <div className="grid gap-2 sm:grid-cols-2">
            <Input name="youtubeUrl" placeholder="YouTube URL" />
            <Input name="twitchUrl" placeholder="Twitch URL" />
            <Input name="tiktokUrl" placeholder="TikTok URL" />
            <Input name="instagramUrl" placeholder="Instagram URL" />
            <Input name="xUrl" placeholder="X / Twitter URL" />
            <Input name="websiteUrl" placeholder="Website" />
          </div>
          <Input name="portfolioUrl" placeholder="Portfolio URL" />
          <Textarea name="message" placeholder="Tell us about your work" rows={4} />
          <div>
            <label className="text-sm font-medium">Portfolio screenshots</label>
            <Input
              type="file"
              accept="image/*"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handlePortfolioUpload(f);
              }}
            />
            {uploading && <p className="text-xs text-muted-foreground mt-1">Uploading {progress}%</p>}
            {portfolioImages.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">{portfolioImages.length} file(s) attached</p>
            )}
          </div>
          <Button type="submit" variant="neon" disabled={pending || uploading}>
            Submit application
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
