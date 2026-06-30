"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type AudioTrack = {
  id: string;
  slug: string;
  title: string;
  artist?: string | null;
  coverUrl?: string | null;
  streamUrl: string;
  durationSeconds?: number | null;
  previewLimitSeconds?: number | null;
  waveformPeaks?: number[] | null;
};

type AudioPlayerContextValue = {
  current: AudioTrack | null;
  queue: AudioTrack[];
  isPlaying: boolean;
  progress: number;
  duration: number;
  volume: number;
  playbackRate: number;
  playError: string | null;
  playTrack: (track: AudioTrack, queue?: AudioTrack[]) => void;
  toggle: () => void;
  pause: () => void;
  next: () => void;
  previous: () => void;
  seek: (ratio: number) => void;
  setVolume: (v: number) => void;
  setPlaybackRate: (r: number) => void;
};

const AudioPlayerContext = createContext<AudioPlayerContextValue | null>(null);

export function AudioPlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentRef = useRef<AudioTrack | null>(null);
  const [current, setCurrent] = useState<AudioTrack | null>(null);
  const [queue, setQueue] = useState<AudioTrack[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.85);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [playError, setPlayError] = useState<string | null>(null);

  currentRef.current = current;

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "auto";
    audio.crossOrigin = "anonymous";
    audioRef.current = audio;

    const onMeta = () => {
      const a = audioRef.current;
      if (!a) return;
      const d =
        a.duration && Number.isFinite(a.duration) && a.duration > 0
          ? a.duration
          : currentRef.current?.durationSeconds ?? 0;
      if (d > 0) setDuration(d);
    };

    const onTime = () => {
      const a = audioRef.current;
      if (!a) return;
      setProgress(a.currentTime);
      onMeta();
      const track = currentRef.current;
      const limit = track?.previewLimitSeconds;
      if (limit && a.currentTime >= limit) {
        a.pause();
        setIsPlaying(false);
        a.currentTime = 0;
        setProgress(0);
      }
    };

    const onEnded = () => {
      setIsPlaying(false);
      setProgress(0);
    };

    const onError = () => {
      setIsPlaying(false);
      setPlayError("Audio failed to load — try refreshing the page.");
    };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("durationchange", onMeta);
    audio.addEventListener("canplay", onMeta);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("durationchange", onMeta);
      audio.removeEventListener("canplay", onMeta);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = volume;
  }, [volume]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.playbackRate = playbackRate;
  }, [playbackRate]);

  const playTrack = useCallback((track: AudioTrack, nextQueue?: AudioTrack[]) => {
    const a = audioRef.current;
    if (!a) return;
    const q = nextQueue?.length ? nextQueue : [track];
    const idx = q.findIndex((t) => t.id === track.id);
    setQueue(q);
    setQueueIndex(idx >= 0 ? idx : 0);
    setCurrent(track);
    const seedDuration = track.durationSeconds && track.durationSeconds > 0 ? track.durationSeconds : 0;
    setDuration(seedDuration);
    setProgress(0);
    setPlayError(null);
    a.src = track.streamUrl;
    a.load();
    a.currentTime = 0;
    void a
      .play()
      .then(() => setIsPlaying(true))
      .catch((err: DOMException) => {
        setIsPlaying(false);
        setPlayError(
          err.name === "NotAllowedError"
            ? "Tap play to start audio (browser blocked autoplay)."
            : "Playback failed — audio may be unavailable."
        );
      });
  }, []);

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a || !currentRef.current) return;
    if (isPlaying) {
      a.pause();
      setIsPlaying(false);
    } else {
      setPlayError(null);
      void a
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {
          setIsPlaying(false);
          setPlayError("Playback failed.");
        });
    }
  }, [isPlaying]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const next = useCallback(() => {
    if (queue.length <= 1) return;
    const idx = (queueIndex + 1) % queue.length;
    setQueueIndex(idx);
    playTrack(queue[idx]!, queue);
  }, [playTrack, queue, queueIndex]);

  const previous = useCallback(() => {
    const a = audioRef.current;
    if (a && a.currentTime > 3) {
      a.currentTime = 0;
      setProgress(0);
      return;
    }
    if (queue.length <= 1) return;
    const idx = (queueIndex - 1 + queue.length) % queue.length;
    setQueueIndex(idx);
    playTrack(queue[idx]!, queue);
  }, [playTrack, queue, queueIndex]);

  const seek = useCallback((ratio: number) => {
    const a = audioRef.current;
    const track = currentRef.current;
    const total =
      a?.duration && Number.isFinite(a.duration) && a.duration > 0
        ? a.duration
        : track?.durationSeconds ?? 0;
    if (!a || !total) return;
    a.currentTime = Math.max(0, Math.min(1, ratio)) * total;
    setProgress(a.currentTime);
  }, []);

  const setVolume = useCallback((v: number) => {
    setVolumeState(Math.max(0, Math.min(1, v)));
  }, []);

  const setPlaybackRate = useCallback((r: number) => {
    setPlaybackRateState(r);
  }, []);

  const value: AudioPlayerContextValue = {
    current,
    queue,
    isPlaying,
    progress,
    duration,
    volume,
    playbackRate,
    playError,
    playTrack,
    toggle,
    pause,
    next,
    previous,
    seek,
    setVolume,
    setPlaybackRate,
  };

  return <AudioPlayerContext.Provider value={value}>{children}</AudioPlayerContext.Provider>;
}

export function useAudioPlayer() {
  const ctx = useContext(AudioPlayerContext);
  if (!ctx) throw new Error("useAudioPlayer must be used within AudioPlayerProvider");
  return ctx;
}

export function useOptionalAudioPlayer() {
  return useContext(AudioPlayerContext);
}
