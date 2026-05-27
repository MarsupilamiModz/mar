"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { toggleFavorite } from "@/actions/favorites";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

export function ModCardLikeButton({
  modId,
  initialFavorited = false,
  className,
}: {
  modId: string;
  initialFavorited?: boolean;
  className?: string;
}) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [pending, startTransition] = useTransition();
  const [bump, setBump] = useState(false);

  return (
    <button
      type="button"
      aria-label={favorited ? "Unlike mod" : "Like mod"}
      disabled={pending}
      className={cn(
        "absolute bottom-2.5 right-2.5 z-10 flex h-8 w-8 items-center justify-center rounded-full",
        "border border-white/10 bg-background/70 backdrop-blur-md transition-all duration-200",
        "hover:scale-110 hover:border-neon-purple/50 hover:bg-neon-purple/20",
        bump && "scale-125",
        className
      )}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        startTransition(async () => {
          const r = await toggleFavorite(modId);
          if (r.success) {
            setFavorited(r.data.favorited);
            setBump(true);
            setTimeout(() => setBump(false), 200);
          } else if (r.error === "Unauthorized") {
            toast({ title: "Sign in to like mods", variant: "destructive" });
          }
        });
      }}
    >
      <Heart
        className={cn(
          "h-4 w-4 transition-colors",
          favorited ? "fill-neon-purple text-neon-purple" : "text-muted-foreground"
        )}
      />
    </button>
  );
}
