"use client";

import { memo, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  updateCollectionAdmin,
  deleteCollectionAdmin,
} from "@/actions/admin/collections";

type Collection = {
  id: string;
  slug: string;
  title: string;
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
}: {
  collections: Collection[];
  locale: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle>Collections ({collections.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {collections.length === 0 ? (
          <p className="text-sm text-muted-foreground">No collections yet.</p>
        ) : (
          collections.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/30 pb-3 text-sm">
              <div>
                <div className="flex items-center gap-2">
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
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await updateCollectionAdmin(c.id, {
                        moderationStatus: c.moderationStatus === "APPROVED" ? "ARCHIVED" : "APPROVED",
                      });
                      router.refresh();
                    })
                  }
                >
                  {c.moderationStatus === "APPROVED" ? "Archive" : "Restore"}
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
  );
}

export const CollectionsAdminPanel = memo(CollectionsAdminPanelInner);
