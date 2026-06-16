"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useR2MultipartUpload } from "@/hooks/use-r2-multipart-upload";
import { attachSoundPreviewFromSession, attachSoundCoverFromSession } from "@/actions/sounds";
import { generateWaveformPeaks, isAudioFileName } from "@/lib/sound";
import { formatDuration } from "@/lib/sound";

type Props = {
  modId: string;
  hasPreview?: boolean;
  hasCover?: boolean;
};

function readAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = "metadata";
    audio.src = url;
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Math.floor(audio.duration || 0));
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0);
    };
  });
}

export function SoundPreviewUpload({ modId, hasPreview, hasCover }: Props) {
  const previewRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const { upload, progress, uploading } = useR2MultipartUpload();

  async function handlePreview(file: File) {
    if (!isAudioFileName(file.name)) {
      toast({ title: "Invalid audio format", variant: "destructive" });
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

    const result = await upload({
      purpose: "sound-preview",
      file,
      modId,
    });

    startTransition(async () => {
      const r = await attachSoundPreviewFromSession(modId, result.sessionId, {
        durationSeconds,
        waveformPeaks,
      });
      if (r.success) {
        toast({
          title: "Preview uploaded",
          description: durationSeconds ? formatDuration(durationSeconds) : undefined,
        });
      } else toast({ title: r.error, variant: "destructive" });
    });
  }

  async function handleCover(file: File) {
    const result = await upload({
      purpose: "sound-cover",
      file,
      modId,
    });

    startTransition(async () => {
      const r = await attachSoundCoverFromSession(modId, result.sessionId);
      if (r.success) toast({ title: "Cover uploaded" });
      else toast({ title: r.error, variant: "destructive" });
    });
  }

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="text-base">Sound assets</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium">Preview audio (mp3, wav, ogg, flac, m4a)</label>
          <div className="mt-1 flex gap-2">
            <Input
              ref={previewRef}
              type="file"
              accept=".mp3,.wav,.ogg,.flac,.m4a,audio/*"
              className="flex-1"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handlePreview(f);
              }}
            />
          </div>
          {hasPreview && <p className="text-xs text-emerald-400 mt-1">Preview configured</p>}
        </div>

        <div>
          <label className="text-sm font-medium">Cover image</label>
          <Input
            ref={coverRef}
            type="file"
            accept="image/*"
            className="mt-1"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleCover(f);
            }}
          />
          {hasCover && <p className="text-xs text-emerald-400 mt-1">Cover configured</p>}
        </div>

        {(uploading || pending) && (
          <p className="text-xs text-muted-foreground">Uploading… {progress}%</p>
        )}
        <Button type="button" variant="outline" size="sm" disabled={uploading || pending} onClick={() => previewRef.current?.click()}>
          Upload preview
        </Button>
      </CardContent>
    </Card>
  );
}
