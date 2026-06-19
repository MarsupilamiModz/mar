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
  const audioRef = useRef<HTMLAudioElement | null>(null);
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

  const isGlobalActive = useGlobalPlayer && global?.current?.id === modId;
  const isPlaying = isGlobalActive ? global!.isPlaying : localPlaying;
  const progress = isGlobalActive ? global!.progress : localTime;
  const duration = isGlobalActive
    ? global!.duration || localDuration || durationSeconds || 0
    : localDuration || durationSeconds || 0;

  useEffect(() => {
    setLocalDuration(durationSeconds ?? 0);
  }, [durationSeconds]);

  useEffect(() => {
    if (isGlobalActive || !streamUrl) return;
    const audio = new Audio();
    audio.preload = "metadata";
    audio.src = streamUrl;
    audioRef.current = audio;

    const onMeta = () => {
      if (audio.duration && Number.isFinite(audio.duration)) {
        setLocalDuration(Math.floor(audio.duration));
      }
    };
    const onTime = () => setLocalTime(audio.currentTime);
    const onEnded = () => {
      setLocalPlaying(false);
      setLocalTime(0);
    };

    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.pause();
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnded);
      audioRef.current = null;
    };
  }, [streamUrl, isGlobalActive]);

  useEffect(() => {
    let cancelled = false;
    const el = containerRef.current;
    if (!el || !streamUrl) return;

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
        waveColor: "rgba(168, 85, 247, 0.35)",
        progressColor: "rgba(168, 85, 247, 0.95)",
        cursorColor: "#a855f7",
        ...(waveformPeaks?.length ? { peaks: [waveformPeaks], duration: durationSeconds ?? undefined } : {}),
        url: streamUrl,
      });
      wsRef.current = ws;

      ws.on("ready", () => {
        const d = ws.getDuration();
        if (d && Number.isFinite(d)) setLocalDuration(Math.floor(d));
      });

      ws.on("audioprocess", () => {
        if (!isGlobalActive) setLocalTime(ws.getCurrentTime());
      });

      ws.on("interaction", () => {
        const t = ws.getCurrentTime();
        if (useGlobalPlayer && global?.current?.id === modId) {
          global.seek(duration > 0 ? t / duration : 0);
        } else {
          const a = audioRef.current;
          if (a) a.currentTime = t;
          setLocalTime(t);
        }
      });

      ws.on("play", () => {
        if (!useGlobalPlayer || !global?.current?.id || global.current.id !== modId) {
          setLocalPlaying(true);
        }
      });
      ws.on("pause", () => {
        if (!useGlobalPlayer || !global?.current?.id || global.current.id !== modId) {
          setLocalPlaying(false);
        }
      });
    });

    return () => {
      cancelled = true;
      wsRef.current?.destroy();
      wsRef.current = null;
    };
  }, [waveformPeaks, durationSeconds, streamUrl, modId, global, useGlobalPlayer, isGlobalActive, duration]);

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

    const a = audioRef.current;
    if (a) {
      if (localPlaying) {
        a.pause();
        wsRef.current?.playPause();
        setLocalPlaying(false);
      } else {
        void a.play().then(() => {
          setLocalPlaying(true);
          wsRef.current?.playPause();
        });
      }
      return;
    }

    wsRef.current?.playPause();
    setLocalPlaying((p) => !p);
  }

  useEffect(() => {
    if (!useGlobalPlayer || !global?.current?.id || global.current.id !== modId) return;
    const ws = wsRef.current;
    if (ws?.setTime && duration > 0) {
      ws.setTime(progress);
    }
  }, [progress, duration, global, modId, useGlobalPlayer]);

  const displayDuration =
    previewLimitSeconds && previewLimitSeconds < duration
      ? previewLimitSeconds
      : duration;

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

      <div ref={containerRef} className="w-full min-h-[72px] rounded-md overflow-hidden" />

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
            if (audioRef.current) audioRef.current.volume = v;
            global?.setVolume(v);
          }}
          className="flex-1 accent-neon-purple"
        />
      </div>
    </div>
  );
}
