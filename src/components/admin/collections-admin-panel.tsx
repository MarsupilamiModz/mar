"use client";

import { memo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  updateCollectionAdmin,
  deleteCollectionAdmin,
  createCollectionAdmin,
} from "@/actions/admin/collections";

type Collection = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  bannerUrl: string | null;
  visibility: string;
  moderationStatus: string;
  isFeatured: boolean;
  viewCount: number;
  downloadCount: number;
  followerCount: number;
  owner: { username: string; displayName: string | null };
  _count: { items: number; followers: number };
};

function conversionRate(views: number, downloads: number) {
  if (views <= 0) return "0%";
  return `${((downloads / views) * 100).toFixed(1)}%`;
}

function CollectionsAdminPanelInner({
  collections,
  locale,
  adminUserId,
}: {
  collections: Collection[];
  locale: string;
  adminUserId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <Card className="glass">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>Create collection / modpack</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? "Cancel" : "New collection"}
          </Button>
        </CardHeader>
        {showCreate && (
          <CardContent>
            <form
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                startTransition(async () => {
                  const r = await createCollectionAdmin({
                    title: fd.get("title") as string,
                    ownerId: adminUserId,
                    ownerUsername: (fd.get("ownerUsername") as string) || undefined,
                    description: (fd.get("description") as string) || undefined,
                    coverUrl: (fd.get("coverUrl") as string) || undefined,
                    bannerUrl: (fd.get("bannerUrl") as string) || undefined,
                    visibility: (fd.get("visibility") as "PUBLIC" | "PRIVATE" | "FEATURED") || "PUBLIC",
                  });
                  if (r.success) {
                    toast({ title: "Collection created" });
                    setShowCreate(false);
                    router.refresh();
                  } else toast({ title: r.error, variant: "destructive" });
                });
              }}
            >
              <Input name="title" placeholder="Title" required className="sm:col-span-2" />
              <Input name="ownerUsername" placeholder="Owner username (optional)" />
              <select name="visibility" className="h-10 rounded-md border border-input bg-background/50 px-3 text-sm">
                <option value="PUBLIC">Public</option>
                <option value="FEATURED">Featured</option>
                <option value="PRIVATE">Private</option>
              </select>
              <Input name="coverUrl" placeholder="Thumbnail URL" className="sm:col-span-2" />
              <Input name="bannerUrl" placeholder="Banner URL" className="sm:col-span-2" />
              <Textarea name="description" placeholder="Description" rows={3} className="sm:col-span-2" />
              <Button type="submit" variant="neon" disabled={pending} className="sm:col-span-2 w-fit">
                Create
              </Button>
            </form>
          </CardContent>
        )}
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle>Collections ({collections.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {collections.length === 0 ? (
            <p className="text-sm text-muted-foreground">No collections yet.</p>
          ) : (
            collections.map((c) => (
              <div key={c.id} className="flex flex-wrap items-start justify-between gap-2 border-b border-border/30 pb-3 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link href={`/${locale}/collections/${c.slug}`} className="font-medium hover:text-neon-purple">
                      {c.title}
                    </Link>
                    {c.isFeatured && <Badge>Featured</Badge>}
                    <Badge variant="outline">{c.moderationStatus}</Badge>
                    <Badge variant="outline">{c.visibility}</Badge>
                  </div>
                  <p className="text-muted-foreground text-xs mt-1">
                    by {c.owner.displayName ?? c.owner.username} · {c._count.items} mods
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {c.viewCount} views · {c.downloadCount} installs · {c.followerCount} followers ·{" "}
                    {conversionRate(c.viewCount, c.downloadCount)} conversion
                  </p>
                  {editingId === c.id ? (
                    <form
                      className="mt-3 grid gap-2 sm:grid-cols-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const fd = new FormData(e.currentTarget);
                        startTransition(async () => {
                          await updateCollectionAdmin(c.id, {
                            title: fd.get("title") as string,
                            description: (fd.get("description") as string) || undefined,
                            coverUrl: (fd.get("coverUrl") as string) || undefined,
                            bannerUrl: (fd.get("bannerUrl") as string) || undefined,
                            visibility: fd.get("visibility") as "PUBLIC" | "PRIVATE" | "FEATURED",
                          });
                          setEditingId(null);
                          router.refresh();
                        });
                      }}
                    >
                      <Input name="title" defaultValue={c.title} required className="sm:col-span-2" />
                      <Input name="coverUrl" defaultValue={c.coverUrl ?? ""} placeholder="Thumbnail URL" />
                      <Input name="bannerUrl" defaultValue={c.bannerUrl ?? ""} placeholder="Banner URL" />
                      <select name="visibility" defaultValue={c.visibility} className="h-10 rounded-md border border-input bg-background/50 px-3 text-sm sm:col-span-2">
                        <option value="PUBLIC">Public</option>
                        <option value="FEATURED">Featured</option>
                        <option value="PRIVATE">Private</option>
                      </select>
                      <Textarea name="description" defaultValue={c.description ?? ""} rows={2} className="sm:col-span-2" />
                      <div className="flex gap-1 sm:col-span-2">
                        <Button type="submit" size="sm" variant="neon" disabled={pending}>Save</Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                      </div>
                    </form>
                  ) : (
                    <Button size="sm" variant="ghost" className="mt-2 h-7 px-2" onClick={() => setEditingId(c.id)}>
                      Edit
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        await updateCollectionAdmin(c.id, { isFeatured: !c.isFeatured });
                        router.refresh();
                      })
                    }
                  >
                    {c.isFeatured ? "Unfeature" : "Feature"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        await updateCollectionAdmin(c.id, { moderationStatus: "APPROVED" });
                        router.refresh();
                      })
                    }
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        await updateCollectionAdmin(c.id, { moderationStatus: "REJECTED" });
                        router.refresh();
                      })
                    }
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        if (!confirm("Delete collection?")) return;
                        const r = await deleteCollectionAdmin(c.id);
                        if (r.success) router.refresh();
                        else toast({ title: r.error, variant: "destructive" });
                      })
                    }
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export const CollectionsAdminPanel = memo(CollectionsAdminPanelInner);
