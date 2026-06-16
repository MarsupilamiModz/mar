"use client";

import { AudioPlayerProvider } from "@/components/audio/audio-player-context";
import { GlobalAudioBar } from "@/components/audio/global-audio-bar";

export function PlatformAudioShell({ children }: { children: React.ReactNode }) {
  return (
    <AudioPlayerProvider>
      {children}
      <GlobalAudioBar />
      <div className="h-16" aria-hidden />
    </AudioPlayerProvider>
  );
}
