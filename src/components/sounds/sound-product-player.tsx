"use client";

import { useEffect, useState } from "react";
import { SafeImage } from "@/components/ui/safe-image";
import { SoundWaveformPlayer } from "@/components/audio/sound-waveform-player";
import { buildAssetPublicUrl } from "@/lib/assets";
import { getPreviewLimitSeconds } from "@/lib/sound";
import type { SoundPreviewType } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "next-intl";

type Props = {
  modId: string;
  slug: string;
  title: string;
  sound: {
    artist: string | null;
    audioCategory: string;
    genre: string | null;
    durationSeconds: number | null;
    previewDurationSeconds: number | null;
    previewType: SoundPreviewType;
    previewCustomSeconds: number | null;
    coverImageKey: string | null;
    waveformPeaks: number[] | null;
    playCount: number;
  };
};

export function SoundProductPlayer({ modId, slug, title, sound }: Props) {
  const ts = useTranslations("sounds");
  const [stream, setStream] = useState<{
    streamUrl: string;
    previewLimitSeconds: number | null;
    waveformPeaks: number[] | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/sounds/${modId}/stream`, { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || data.error) return;
        setStream({
          streamUrl: data.streamUrl,
          previewLimitSeconds: data.previewLimitSeconds,
          waveformPeaks: data.waveformPeaks ?? sound.waveformPeaks,
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [modId, sound.waveformPeaks]);

  const coverUrl = sound.coverImageKey ? buildAssetPublicUrl(sound.coverImageKey) : null;
  const limit = getPreviewLimitSeconds(
    sound.previewType,
    sound.previewCustomSeconds,
    sound.previewDurationSeconds ?? sound.durationSeconds
  );

  return (
    <div className="glass rounded-xl border border-border/50 overflow-hidden">
      <div className="grid md:grid-cols-[220px_1fr] gap-0">
        <div className="relative aspect-square md:aspect-auto md:min-h-[220px] bg-gradient-to-br from-neon-purple/20 to-neon-blue/10">
          {coverUrl ? (
            <SafeImage src={coverUrl} alt={title} fill className="object-cover" sizes="220px" />
          ) : (
            <div className="flex h-full min-h-[180px] items-center justify-center text-5xl text-neon-purple/60">♪</div>
          )}
        </div>
        <div className="p-5 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{ts(`categories.${categoryKey(sound.audioCategory)}`)}</Badge>
            {sound.genre && <Badge variant="outline">{sound.genre}</Badge>}
            <Badge variant="secondary">{sound.playCount.toLocaleString()} {ts("plays")}</Badge>
          </div>
          {sound.artist && <p className="text-sm text-muted-foreground">{sound.artist}</p>}
          {loading ? (
            <p className="text-sm text-muted-foreground">{ts("loadingPreview")}</p>
          ) : stream ? (
            <SoundWaveformPlayer
              modId={modId}
              slug={slug}
              title={title}
              artist={sound.artist}
              coverUrl={coverUrl}
              streamUrl={stream.streamUrl}
              durationSeconds={sound.previewDurationSeconds ?? sound.durationSeconds}
              previewLimitSeconds={stream.previewLimitSeconds ?? limit}
              waveformPeaks={stream.waveformPeaks}
            />
          ) : (
            <p className="text-sm text-muted-foreground">{ts("previewUnavailable")}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function categoryKey(cat: string) {
  const map: Record<string, string> = {
    ENGINE_SOUNDS: "engineSounds",
    WEAPON_SOUNDS: "weaponSounds",
    SIRENS: "sirens",
    UI_SOUNDS: "uiSounds",
    AMBIENT_SOUNDS: "ambientSounds",
    RADIO_PACKS: "radioPacks",
    VOICE_PACKS: "voicePacks",
    EFFECTS: "effects",
    MUSIC_PACKS: "musicPacks",
    CUSTOM_AUDIO: "customAudio",
  };
  return map[cat] ?? "customAudio";
}
