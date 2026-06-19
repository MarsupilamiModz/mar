"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useR2MultipartUpload } from "@/hooks/use-r2-multipart-upload";
import { attachSoundPreviewFromSession, attachSoundCoverFromSession } from "@/actions/sounds";
import { generateWaveformPeaks, isAudioFileName, formatDuration } from "@/lib/sound";

type Props = {
  modId: string;
  hasPreview?: boolean;
  hasCover?: boolean;
};

function readAudioDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = "metadata";
    audio.src = url;
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      const d = audio.duration;
      resolve(Number.isFinite(d) && d > 0 ? Math.floor(d) : null);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
  });
}

export function SoundPreviewUpload({ modId, hasPreview, hasCover }: Props) {
  const previewRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [localError, setLocalError] = useState<string | null>(null);
  const { upload, progress, uploading, error: uploadError } = useR2MultipartUpload();

  async function handlePreview(file: File) {
    setLocalError(null);
    try {
      if (!isAudioFileName(file.name)) {
        toast({ title: "Invalid audio format", description: "Use mp3, wav, ogg, flac, or m4a.", variant: "destructive" });
        return;
      }

      const [durationSeconds, arrayBuffer] = await Promise.all([
        readAudioDuration(file),
        file.arrayBuffer(),
      ]);

      let waveformPeaks: number[] | undefined;
      try {
        waveformPeaks = await generateWaveformPeaks(arrayBuffer);
      } catch {
        waveformPeaks = undefined;
      }

      const result = await upload({ purpose: "sound-preview", file, modId });
      if (!result.sessionId) throw new Error("Upload did not return a session");

      startTransition(async () => {
        const r = await attachSoundPreviewFromSession(modId, result.sessionId, {
          ...(durationSeconds != null ? { durationSeconds } : {}),
          waveformPeaks,
        });
        if (r.success) {
          toast({
            title: "Preview uploaded",
            description: durationSeconds ? formatDuration(durationSeconds) : undefined,
          });
          router.refresh();
        } else {
          setLocalError(r.error);
          toast({ title: r.error, variant: "destructive" });
        }
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Preview upload failed";
      setLocalError(message);
      toast({ title: message, variant: "destructive" });
    }
  }

  async function handleCover(file: File) {
    setLocalError(null);
    try {
      const result = await upload({ purpose: "sound-cover", file, modId });
      if (!result.sessionId) throw new Error("Upload did not return a session");

      startTransition(async () => {
        const r = await attachSoundCoverFromSession(modId, result.sessionId);
        if (r.success) {
          toast({ title: "Cover uploaded" });
          router.refresh();
        } else {
          setLocalError(r.error);
          toast({ title: r.error, variant: "destructive" });
        }
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Cover upload failed";
      setLocalError(message);
      toast({ title: message, variant: "destructive" });
    }
  }

  const busy = uploading || pending;

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="text-base">Sound assets</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium">Preview audio (mp3, wav, ogg, flac, m4a)</label>
          <Input
            ref={previewRef}
            type="file"
            accept=".mp3,.wav,.ogg,.flac,.m4a,audio/*"
            className="mt-1"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handlePreview(f);
              e.target.value = "";
            }}
          />
          {hasPreview && <p className="text-xs text-emerald-400 mt-1">Preview configured</p>}
        </div>

        <div>
          <label className="text-sm font-medium">Cover image</label>
          <Input
            ref={coverRef}
            type="file"
            accept="image/*"
            className="mt-1"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleCover(f);
              e.target.value = "";
            }}
          />
          {hasCover && <p className="text-xs text-emerald-400 mt-1">Cover configured</p>}
        </div>

        {busy && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Uploading… {progress}%
          </div>
        )}

        {(localError || uploadError) && (
          <p className="text-xs text-destructive">{localError ?? uploadError}</p>
        )}

        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => previewRef.current?.click()}>
            Upload preview
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => coverRef.current?.click()}>
            Upload cover
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
