"use client";

import { useEffect, useState, useTransition } from "react";
import {
  createAnnouncement,
  deleteAnnouncement,
  listAnnouncements,
  toggleAnnouncement,
} from "@/actions/admin/announcements";
import { ANNOUNCEMENT_TARGETS, parseVisibilityTargets } from "@/lib/announcement-targeting";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

type Announcement = {
  id: string;
  title: string;
  content: string;
  link: string | null;
  isActive: boolean;
  visibilityTargets: unknown;
};

export default function AdminAnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [pending, startTransition] = useTransition();
  const [selectedTargets, setSelectedTargets] = useState<string[]>(["everyone"]);

  function load() {
    startTransition(async () => {
      const r = await listAnnouncements();
      if (r.success) setItems(r.data as Announcement[]);
    });
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold">Announcements</h1>
      <p className="mt-1 text-sm text-muted-foreground">Site-wide banners on the homepage</p>

      <Card className="glass mt-8 p-6 max-w-xl">
        <h3 className="font-medium mb-4">Create announcement</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(async () => {
              const r = await createAnnouncement({
                title: fd.get("title") as string,
                content: fd.get("content") as string,
                link: (fd.get("link") as string) || "",
                isActive: true,
                visibilityTargets: selectedTargets,
              });
              if (r.success) {
                toast({ title: "Created" });
                e.currentTarget.reset();
                setSelectedTargets(["everyone"]);
                load();
              } else toast({ title: "Error", description: r.error, variant: "destructive" });
            });
          }}
          className="space-y-3"
        >
          <Input name="title" placeholder="Title" required />
          <Textarea name="content" placeholder="Message" required rows={2} />
          <Input name="link" placeholder="Optional link URL" type="url" />
          <div className="space-y-2">
            <p className="text-sm font-medium">Visibility</p>
            <div className="flex flex-wrap gap-2">
              {ANNOUNCEMENT_TARGETS.map((t) => (
                <label key={t.id} className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={selectedTargets.includes(t.id)}
                    onChange={(e) => {
                      setSelectedTargets((prev) =>
                        e.target.checked
                          ? [...prev.filter((x) => x !== "everyone"), t.id]
                          : prev.filter((x) => x !== t.id)
                      );
                    }}
                  />
                  {t.label}
                </label>
              ))}
            </div>
          </div>
          <Button type="submit" variant="neon" disabled={pending}>
            Publish
          </Button>
        </form>
      </Card>

      <div className="mt-8 space-y-3">
        {items.map((a) => (
          <Card key={a.id} className="glass p-4 flex justify-between items-start gap-4">
            <div>
              <p className="font-medium">{a.title}</p>
              <p className="text-sm text-muted-foreground mt-1">{a.content}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Visible to: {parseVisibilityTargets(a.visibilityTargets).join(", ")}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Badge variant={a.isActive ? "default" : "outline"}>{a.isActive ? "Active" : "Off"}</Badge>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await toggleAnnouncement(a.id, !a.isActive);
                    load();
                  })
                }
              >
                Toggle
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await deleteAnnouncement(a.id);
                    load();
                  })
                }
              >
                Delete
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
