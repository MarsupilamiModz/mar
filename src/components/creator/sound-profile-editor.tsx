"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateSoundProfile } from "@/actions/sounds";
import { SOUND_CATEGORIES, PREVIEW_TYPES } from "@/lib/sound";
import type { SoundAudioCategory, SoundPreviewType } from "@prisma/client";

type Profile = {
  artist: string | null;
  audioCategory: SoundAudioCategory;
  durationSeconds: number | null;
  bpm: number | null;
  genre: string | null;
  previewType: SoundPreviewType;
  previewCustomSeconds: number | null;
};

export function SoundProfileEditor({ modId, profile }: { modId: string; profile: Profile | null }) {
  const ts = useTranslations("sounds");
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    artist: profile?.artist ?? "",
    audioCategory: profile?.audioCategory ?? "CUSTOM_AUDIO",
    durationSeconds: profile?.durationSeconds?.toString() ?? "",
    bpm: profile?.bpm?.toString() ?? "",
    genre: profile?.genre ?? "",
    previewType: profile?.previewType ?? "FULL",
    previewCustomSeconds: profile?.previewCustomSeconds?.toString() ?? "",
  });

  useEffect(() => {
    setForm({
      artist: profile?.artist ?? "",
      audioCategory: profile?.audioCategory ?? "CUSTOM_AUDIO",
      durationSeconds: profile?.durationSeconds?.toString() ?? "",
      bpm: profile?.bpm?.toString() ?? "",
      genre: profile?.genre ?? "",
      previewType: profile?.previewType ?? "FULL",
      previewCustomSeconds: profile?.previewCustomSeconds?.toString() ?? "",
    });
  }, [profile]);

  function save() {
    startTransition(async () => {
      const r = await updateSoundProfile(modId, {
        artist: form.artist || undefined,
        audioCategory: form.audioCategory,
        durationSeconds: form.durationSeconds ? Number(form.durationSeconds) : undefined,
        bpm: form.bpm ? Number(form.bpm) : undefined,
        genre: form.genre || undefined,
        previewType: form.previewType,
        previewCustomSeconds:
          form.previewType === "CUSTOM" && form.previewCustomSeconds
            ? Number(form.previewCustomSeconds)
            : undefined,
      });
      if (r.success) toast({ title: "Sound metadata saved" });
      else toast({ title: r.error, variant: "destructive" });
    });
  }

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="text-base">{ts("metadata")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-sm">{ts("artist")}</label>
          <Input value={form.artist} onChange={(e) => setForm((f) => ({ ...f, artist: e.target.value }))} />
        </div>
        <div>
          <label className="text-sm">{ts("audioCategory")}</label>
          <Select
            value={form.audioCategory}
            onValueChange={(v) => setForm((f) => ({ ...f, audioCategory: v as SoundAudioCategory }))}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {SOUND_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {ts(`categories.${c.labelKey}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm">{ts("duration")}</label>
          <Input
            type="number"
            value={form.durationSeconds}
            onChange={(e) => setForm((f) => ({ ...f, durationSeconds: e.target.value }))}
          />
        </div>
        <div>
          <label className="text-sm">{ts("bpm")}</label>
          <Input value={form.bpm} onChange={(e) => setForm((f) => ({ ...f, bpm: e.target.value }))} />
        </div>
        <div>
          <label className="text-sm">{ts("genre")}</label>
          <Input value={form.genre} onChange={(e) => setForm((f) => ({ ...f, genre: e.target.value }))} />
        </div>
        <div>
          <label className="text-sm">{ts("previewType")}</label>
          <Select
            value={form.previewType}
            onValueChange={(v) => setForm((f) => ({ ...f, previewType: v as SoundPreviewType }))}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PREVIEW_TYPES.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {ts(`preview.${p.labelKey}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {form.previewType === "CUSTOM" && (
          <div>
            <label className="text-sm">{ts("previewCustomSeconds")}</label>
            <Input
              type="number"
              value={form.previewCustomSeconds}
              onChange={(e) => setForm((f) => ({ ...f, previewCustomSeconds: e.target.value }))}
            />
          </div>
        )}
        <div className="sm:col-span-2">
          <Button onClick={save} disabled={pending} size="sm">
            Save metadata
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
