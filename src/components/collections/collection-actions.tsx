"use client";

import { useTransition } from "react";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { followCollection, unfollowCollection, bulkDownloadCollection } from "@/actions/collections";

export function CollectionActions({
  collectionId,
  modIds,
  initialFollowing,
}: {
  collectionId: string;
  modIds: string[];
  initialFollowing: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function toggleFollow() {
    startTransition(async () => {
      const r = initialFollowing
        ? await unfollowCollection(collectionId)
        : await followCollection(collectionId);
      if (r.success) window.location.reload();
    });
  }

  function installAll() {
    startTransition(async () => {
      const r = await bulkDownloadCollection(collectionId);
      if (r.success) {
        toast({ title: `${r.data.count} mods added to library` });
        for (const id of modIds) {
          const res = await fetch(`/api/mods/${id}/download?skipDeps=1`, { method: "POST" });
          if (res.ok) {
            const { url } = await res.json();
            window.open(url, "_blank");
          }
        }
      } else toast({ title: r.error, variant: "destructive" });
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="neon" disabled={pending} onClick={installAll}>
        Download entire collection
      </Button>
      <Button variant="outline" disabled={pending} onClick={toggleFollow}>
        {initialFollowing ? "Unfollow" : "Follow collection"}
      </Button>
    </div>
  );
}
