"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  saveTutorial,
  saveTutorialCategory,
  deleteTutorial,
  seedDefaultTutorialCategories,
  uploadTutorialVideo,
} from "@/actions/admin/tutorials";
import type { TutorialLevel, TutorialStatus, TutorialType } from "@prisma/client";

type AdminData = Extract<
  Awaited<ReturnType<typeof import("@/actions/admin/tutorials").getTutorialsAdminData>>,
  { success: true }
>["data"];

export function TutorialsAdminPanel({ data }: { data: AdminData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    title: "",
    description: "",
    content: "",
    type: "YOUTUBE" as TutorialType,
    level: "BEGINNER" as TutorialLevel,
    status: "DRAFT" as TutorialStatus,
    categoryId: "",
    youtubeUrl: "",
    videoUrl: "",
    videoFileKey: "",
  });
  const [uploading, setUploading] = useState(false);
  const [catName, setCatName] = useState("");

  return (
    <Tabs defaultValue="tutorials" className="space-y-6">
      <TabsList>
        <TabsTrigger value="tutorials">Tutorials</TabsTrigger>
        <TabsTrigger value="categories">Kategorien</TabsTrigger>
      </TabsList>

      <TabsContent value="tutorials" className="space-y-4">
        <Card className="card-surface">
          <CardHeader>
            <CardTitle>Tutorial erstellen</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Input placeholder="Titel" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as TutorialType }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["YOUTUBE", "VIDEO", "ARTICLE", "MIXED"] as const).map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={form.level} onValueChange={(v) => setForm((f) => ({ ...f, level: v as TutorialLevel }))}>
              <SelectTrigger><SelectValue placeholder="Level" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="BEGINNER">Anfänger</SelectItem>
                <SelectItem value="INTERMEDIATE">Fortgeschritten</SelectItem>
                <SelectItem value="ADVANCED">Profi</SelectItem>
              </SelectContent>
            </Select>
            <Select value={form.categoryId || "none"} onValueChange={(v) => setForm((f) => ({ ...f, categoryId: v === "none" ? "" : v }))}>
              <SelectTrigger><SelectValue placeholder="Kategorie" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Keine</SelectItem>
                {data.categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input placeholder="YouTube URL" className="sm:col-span-2" value={form.youtubeUrl} onChange={(e) => setForm((f) => ({ ...f, youtubeUrl: e.target.value }))} />
            <Input placeholder="Video URL (R2 mp4/webm)" className="sm:col-span-2" value={form.videoUrl} onChange={(e) => setForm((f) => ({ ...f, videoUrl: e.target.value }))} />
            <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
              <Input
                type="file"
                accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  const fd = new FormData();
                  fd.set("file", file);
                  void uploadTutorialVideo(fd)
                    .then((r) => {
                      if (r.success) {
                        setForm((f) => ({
                          ...f,
                          videoUrl: r.data.videoUrl,
                          videoFileKey: r.data.fileKey,
                          type: f.type === "ARTICLE" ? "MIXED" : f.type === "YOUTUBE" ? "VIDEO" : f.type,
                        }));
                        toast({ title: "Video hochgeladen" });
                      } else toast({ title: r.error, variant: "destructive" });
                    })
                    .finally(() => setUploading(false));
                }}
              />
              {uploading ? <span className="text-xs text-muted-foreground">Upload läuft…</span> : null}
              {form.videoUrl ? <span className="text-xs text-emerald-400 truncate max-w-xs">{form.videoUrl}</span> : null}
            </div>
            <Textarea placeholder="Kurzbeschreibung" className="sm:col-span-2" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            <Textarea placeholder="Artikel-Inhalt" className="sm:col-span-2 min-h-[120px]" value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} />
            <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as TutorialStatus }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="DRAFT">Entwurf</SelectItem>
                <SelectItem value="PUBLISHED">Veröffentlicht</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="neon"
              disabled={pending || !form.title}
              onClick={() =>
                startTransition(async () => {
                  const r = await saveTutorial(form);
                  if (r.success) {
                    toast({ title: "Tutorial gespeichert" });
                    router.refresh();
                  } else toast({ title: r.error, variant: "destructive" });
                })
              }
            >
              Speichern
            </Button>
          </CardContent>
        </Card>

        {data.tutorials.map((t) => (
          <Card key={t.id} className="card-surface p-4 flex justify-between gap-3">
            <div>
              <p className="font-medium">{t.title}</p>
              <p className="text-xs text-muted-foreground">{t.type} · {t.status} · {t.viewCount} views</p>
            </div>
            <Button size="sm" variant="destructive" disabled={pending} onClick={() => startTransition(async () => { await deleteTutorial(t.id); router.refresh(); })}>Löschen</Button>
          </Card>
        ))}
      </TabsContent>

      <TabsContent value="categories" className="space-y-4">
        <Card className="card-surface p-4 flex flex-wrap gap-2">
          <Input placeholder="Kategorie Name" value={catName} onChange={(e) => setCatName(e.target.value)} />
          <Button variant="neon" size="sm" disabled={!catName} onClick={() => startTransition(async () => { await saveTutorialCategory({ name: catName }); setCatName(""); router.refresh(); })}>Hinzufügen</Button>
          <Button variant="outline" size="sm" onClick={() => startTransition(async () => { await seedDefaultTutorialCategories(); router.refresh(); })}>Standard-Kategorien</Button>
        </Card>
        {data.categories.map((c) => (
          <Card key={c.id} className="card-surface p-3 text-sm">{c.name}</Card>
        ))}
      </TabsContent>
    </Tabs>
  );
}
