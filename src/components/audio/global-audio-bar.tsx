"use client";

import { Pause, Play, SkipBack, SkipForward, Volume2 } from "lucide-react";
import { SafeImage } from "@/components/ui/safe-image";
import { useAudioPlayer } from "@/components/audio/audio-player-context";
import { formatDuration } from "@/lib/sound";
import { cn } from "@/lib/utils";

export function GlobalAudioBar() {
  const {
    current,
    isPlaying,
    progress,
    duration,
    volume,
    playbackRate,
    toggle,
    next,
    previous,
    setVolume,
    setPlaybackRate,
  } = useAudioPlayer();

  if (!current) return null;

  return (
    <div
      className={cn(
        "fixed bottom-0 inset-x-0 z-50 border-t border-border/60 bg-background/95 backdrop-blur-md",
        "shadow-[0_-8px_32px_-8px_rgba(0,0,0,0.45)]"
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 sm:gap-4">
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
          {current.coverUrl ? (
            <SafeImage src={current.coverUrl} alt="" fill className="object-cover" sizes="40px" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-neon-purple">♪</div>
          )}
        </div>

        <div className="min-w-0 flex-1 hidden sm:block">
          <p className="truncate text-sm font-medium">{current.title}</p>
          {current.artist && (
            <p className="truncate text-xs text-muted-foreground">{current.artist}</p>
          )}
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <button type="button" onClick={previous} className="rounded p-2 hover:bg-accent/30" aria-label="Previous">
            <SkipBack className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={toggle}
            className="rounded-full bg-neon-purple p-2 text-white hover:opacity-90"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
          </button>
          <button type="button" onClick={next} className="rounded p-2 hover:bg-accent/30" aria-label="Next">
            <SkipForward className="h-4 w-4" />
          </button>
        </div>

        <div className="hidden md:flex items-center gap-2 text-xs tabular-nums text-muted-foreground min-w-[90px]">
          {formatDuration(progress)} / {formatDuration(duration)}
        </div>

        <div className="hidden lg:flex items-center gap-2 min-w-[120px]">
          <Volume2 className="h-4 w-4 text-muted-foreground" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="w-20 accent-neon-purple"
          />
        </div>

        <select
          value={playbackRate}
          onChange={(e) => setPlaybackRate(Number(e.target.value))}
          className="hidden sm:block h-8 rounded border border-input bg-background/60 px-2 text-xs"
          aria-label="Playback speed"
        >
          {[0.75, 1, 1.25, 1.5, 2].map((r) => (
            <option key={r} value={r}>
              {r}x
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
