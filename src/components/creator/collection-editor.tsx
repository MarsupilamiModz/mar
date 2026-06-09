"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createCollection,
  updateCollection,
  deleteCollection,
  addModToCollection,
  removeModFromCollection,
  reorderCollectionMods,
} from "@/actions/collections";
import type { CollectionVisibility } from "@prisma/client";
import type { Locale } from "@/i18n/config";

type CollectionItem = {
  modId: string;
  sortOrder: number;
  note: string | null;
  mod: { id: string; slug: string; title: string };
};

type Collection = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  visibility: CollectionVisibility;
  items: CollectionItem[];
};

export function CollectionCreateForm({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Card className="glass max-w-xl">
      <CardHeader><CardTitle>Create collection</CardTitle></CardHeader>
      <CardContent>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(async () => {
              const r = await createCollection({
                title: fd.get("title") as string,
                description: (fd.get("description") as string) || undefined,
                visibility: (fd.get("visibility") as CollectionVisibility) || "PUBLIC",
                coverUrl: (fd.get("coverUrl") as string) || undefined,
              });
              if (r.success) {
                toast({ title: "Collection created" });
                router.push(`/${locale}/creator/collections/${r.data.id}`);
              } else toast({ title: r.error, variant: "destructive" });
            });
          }}
        >
          <Input name="title" placeholder="Collection title" required />
          <Textarea name="description" placeholder="Description" rows={3} />
          <Input name="coverUrl" placeholder="Cover image URL (optional)" />
          <select name="visibility" className="h-10 w-full rounded-md border border-input bg-background/50 px-3 text-sm">
            <option value="PUBLIC">Public</option>
            <option value="PRIVATE">Private</option>
          </select>
          <Button type="submit" variant="neon" disabled={pending}>Create</Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function CollectionEditForm({ locale, collection }: { locale: Locale; collection: Collection }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [modQuery, setModQuery] = useState("");

  function refresh() {
    router.refresh();
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Card className="glass">
        <CardHeader><CardTitle>{collection.title}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              startTransition(async () => {
                const r = await updateCollection(collection.id, {
                  title: fd.get("title") as string,
                  description: (fd.get("description") as string) || undefined,
                  visibility: fd.get("visibility") as CollectionVisibility,
                  coverUrl: (fd.get("coverUrl") as string) || undefined,
                });
                if (r.success) {
                  toast({ title: "Saved" });
                  refresh();
                } else toast({ title: r.error, variant: "destructive" });
              });
            }}
          >
            <Input name="title" defaultValue={collection.title} required />
            <Textarea name="description" defaultValue={collection.description ?? ""} rows={3} />
            <Input name="coverUrl" defaultValue={collection.coverUrl ?? ""} placeholder="Cover URL" />
            <select name="visibility" defaultValue={collection.visibility} className="h-10 w-full rounded-md border border-input bg-background/50 px-3 text-sm">
              <option value="PUBLIC">Public</option>
              <option value="PRIVATE">Private</option>
            </select>
            <div className="flex gap-2">
              <Button type="submit" variant="neon" disabled={pending}>Save</Button>
              <Button type="button" variant="outline" asChild>
                <Link href={`/${locale}/collections/${collection.slug}`}>View public</Link>
              </Button>
            </div>
          </form>
          <Button
            variant="destructive"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                if (!confirm("Delete this collection?")) return;
                const r = await deleteCollection(collection.id);
                if (r.success) router.push(`/${locale}/creator/collections`);
              })
            }
          >
            Delete collection
          </Button>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader><CardTitle>Mods in collection</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {collection.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No mods yet.</p>
          ) : (
            collection.items.map((item, idx) => (
              <div key={item.modId} className="flex items-center justify-between gap-2 text-sm border-b border-border/30 pb-2">
                <span>{idx + 1}. {item.mod.title}</span>
                <div className="flex gap-1">
                  {idx > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => {
                        const ids = collection.items.map((i) => i.modId);
                        [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
                        startTransition(async () => {
                          await reorderCollectionMods(collection.id, ids);
                          refresh();
                        });
                      }}
                    >
                      ↑
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        await removeModFromCollection(collection.id, item.modId);
                        refresh();
                      })
                    }
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))
          )}

          <div className="flex gap-2 pt-2">
            <Input
              value={modQuery}
              onChange={(e) => setModQuery(e.target.value)}
              placeholder="Mod ID to add"
            />
            <Button
              variant="outline"
              disabled={pending || !modQuery.trim()}
              onClick={() =>
                startTransition(async () => {
                  const r = await addModToCollection(collection.id, modQuery.trim());
                  if (r.success) {
                    toast({ title: "Mod added" });
                    setModQuery("");
                    refresh();
                  } else toast({ title: r.error, variant: "destructive" });
                })
              }
            >
              Add mod
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
