"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, Volume2 } from "lucide-react";
import { formatDuration } from "@/lib/sound";
import { useOptionalAudioPlayer, type AudioTrack } from "@/components/audio/audio-player-context";
import { cn } from "@/lib/utils";

type Props = {
  modId: string;
  slug: string;
  title: string;
  artist?: string | null;
  coverUrl?: string | null;
  streamUrl: string;
  durationSeconds?: number | null;
  previewLimitSeconds?: number | null;
  waveformPeaks?: number[] | null;
  className?: string;
  useGlobalPlayer?: boolean;
};

export function SoundWaveformPlayer({
  modId,
  slug,
  title,
  artist,
  coverUrl,
  streamUrl,
  durationSeconds,
  previewLimitSeconds,
  waveformPeaks,
  className,
  useGlobalPlayer = true,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<{
    destroy: () => void;
    playPause: () => void;
    seekTo: (p: number) => void;
    getCurrentTime: () => number;
    setTime?: (t: number) => void;
  } | null>(null);
  const global = useOptionalAudioPlayer();
  const [localPlaying, setLocalPlaying] = useState(false);
  const [localTime, setLocalTime] = useState(0);
  const [localDuration, setLocalDuration] = useState(durationSeconds ?? 0);
  const [volume, setVolume] = useState(0.85);
  const [waveReady, setWaveReady] = useState(false);
  const [waveError, setWaveError] = useState(false);

  const isGlobalActive = useGlobalPlayer && global?.current?.id === modId;
  const isPlaying = isGlobalActive ? global!.isPlaying : localPlaying;
  const progress = isGlobalActive ? global!.progress : localTime;
  const duration = isGlobalActive
    ? global!.duration || localDuration || durationSeconds || 0
    : localDuration || durationSeconds || 0;

  useEffect(() => {
    setLocalDuration(durationSeconds ?? 0);
  }, [durationSeconds]);

  // WaveSurfer — visual only; playback goes through global HTMLAudioElement.
  useEffect(() => {
    let cancelled = false;
    const el = containerRef.current;
    if (!el || !streamUrl) return;

    setWaveReady(false);
    setWaveError(false);

    void import("wavesurfer.js").then(({ default: WaveSurfer }) => {
      if (cancelled || !containerRef.current) return;

      const ws = WaveSurfer.create({
        container: containerRef.current!,
        height: 72,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        cursorWidth: 2,
        normalize: true,
        interact: true,
        mediaControls: false,
        waveColor: "rgba(168, 85, 247, 0.35)",
        progressColor: "rgba(168, 85, 247, 0.95)",
        cursorColor: "#a855f7",
        ...(waveformPeaks?.length
          ? { peaks: [waveformPeaks], duration: durationSeconds ?? undefined }
          : {}),
        url: streamUrl,
      });
      wsRef.current = ws;

      ws.on("ready", () => {
        if (cancelled) return;
        setWaveReady(true);
        setWaveError(false);
        const d = ws.getDuration();
        if (d && Number.isFinite(d)) setLocalDuration(Math.floor(d));
      });

      ws.on("error", () => {
        if (cancelled) return;
        setWaveError(true);
        setWaveReady(false);
      });

      ws.on("interaction", () => {
        const t = ws.getCurrentTime();
        const total = duration || durationSeconds || ws.getDuration() || 1;
        if (useGlobalPlayer && global?.current?.id === modId) {
          global.seek(total > 0 ? t / total : 0);
        } else {
          setLocalTime(t);
        }
      });
    });

    return () => {
      cancelled = true;
      wsRef.current?.destroy();
      wsRef.current = null;
    };
  }, [waveformPeaks, durationSeconds, streamUrl, modId, useGlobalPlayer]);

  // Sync waveform cursor with global player progress.
  useEffect(() => {
    if (!isGlobalActive || !waveReady) return;
    const ws = wsRef.current;
    const total = duration || durationSeconds || 0;
    if (ws && total > 0 && typeof ws.seekTo === "function") {
      ws.seekTo(Math.min(1, progress / total));
    }
  }, [progress, duration, durationSeconds, isGlobalActive, waveReady]);

  function togglePlay() {
    const track: AudioTrack = {
      id: modId,
      slug,
      title,
      artist,
      coverUrl,
      streamUrl,
      durationSeconds: duration || durationSeconds,
      previewLimitSeconds,
      waveformPeaks,
    };

    if (useGlobalPlayer && global) {
      if (global.current?.id === modId) {
        global.toggle();
      } else {
        global.playTrack(track);
      }
      return;
    }

    wsRef.current?.playPause();
    setLocalPlaying((p) => !p);
  }

  const displayDuration =
    previewLimitSeconds && previewLimitSeconds < duration
      ? previewLimitSeconds
      : duration;

  const errorMessage = global?.playError ?? (waveError ? "Audio failed to load" : null);

  return (
    <div className={cn("rounded-xl border border-border/50 bg-background/40 p-4 space-y-3", className)}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-neon-purple text-white shadow-[0_0_20px_-4px_rgba(168,85,247,0.6)] hover:scale-105 transition-transform"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate">{title}</p>
          {artist && <p className="text-xs text-muted-foreground truncate">{artist}</p>}
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">
          {formatDuration(progress)} / {formatDuration(displayDuration)}
        </span>
      </div>

      <div ref={containerRef} className="w-full min-h-[72px] rounded-md overflow-hidden relative">
        {!waveReady && !waveError && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground animate-pulse">
            Loading waveform…
          </div>
        )}
      </div>

      {errorMessage && (
        <p className="text-xs text-destructive/90">{errorMessage}</p>
      )}

      <div className="flex items-center gap-2 text-muted-foreground">
        <Volume2 className="h-4 w-4" />
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={useGlobalPlayer && global ? global.volume : volume}
          onChange={(e) => {
            const v = Number(e.target.value);
            setVolume(v);
            global?.setVolume(v);
          }}
          className="flex-1 accent-neon-purple"
        />
      </div>
    </div>
  );
}
