"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { toggleFavorite } from "@/actions/favorites";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export function FavoriteButton({
  modId,
  initialFavorited = false,
}: {
  modId: string;
  initialFavorited?: boolean;
}) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="icon"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await toggleFavorite(modId);
          if (r.success) {
            setFavorited(r.data.favorited);
            toast({ title: r.data.favorited ? "Added to favorites" : "Removed from favorites" });
          } else if (r.error === "Unauthorized") {
            toast({ title: "Sign in required", variant: "destructive" });
          }
        })
      }
    >
      <Heart className={cn("h-4 w-4", favorited && "fill-neon-purple text-neon-purple")} />
    </Button>
  );
}
