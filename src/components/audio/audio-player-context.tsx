"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
  const [current, setCurrent] = useState<AudioTrack | null>(null);
  const [queue, setQueue] = useState<AudioTrack[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.85);
  const [playbackRate, setPlaybackRateState] = useState(1);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "metadata";
    audioRef.current = audio;

    const onTime = () => {
      const a = audioRef.current;
      if (!a) return;
      setProgress(a.currentTime);
      const metaDuration =
        a.duration && Number.isFinite(a.duration) && a.duration > 0
          ? a.duration
          : current?.durationSeconds ?? 0;
      setDuration(metaDuration);
      const limit = current?.previewLimitSeconds;
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

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onTime);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onTime);
      audio.removeEventListener("ended", onEnded);
      audioRef.current = null;
    };
  }, [current?.previewLimitSeconds]);

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
    setDuration(track.durationSeconds ?? 0);
    a.src = track.streamUrl;
    a.currentTime = 0;
    void a.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
  }, []);

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a || !current) return;
    if (isPlaying) {
      a.pause();
      setIsPlaying(false);
    } else {
      void a.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  }, [current, isPlaying]);

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
    if (!a || !a.duration) return;
    a.currentTime = Math.max(0, Math.min(1, ratio)) * a.duration;
    setProgress(a.currentTime);
  }, []);

  const setVolume = useCallback((v: number) => {
    setVolumeState(Math.max(0, Math.min(1, v)));
  }, []);

  const setPlaybackRate = useCallback((r: number) => {
    setPlaybackRateState(r);
  }, []);

  const value = useMemo(
    () => ({
      current,
      queue,
      isPlaying,
      progress,
      duration,
      volume,
      playbackRate,
      playTrack,
      toggle,
      pause,
      next,
      previous,
      seek,
      setVolume,
      setPlaybackRate,
    }),
    [
      current,
      queue,
      isPlaying,
      progress,
      duration,
      volume,
      playbackRate,
      playTrack,
      toggle,
      pause,
      next,
      previous,
      seek,
      setVolume,
      setPlaybackRate,
    ]
  );

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
