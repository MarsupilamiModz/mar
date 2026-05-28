"use client";

import { useEffect, useState, useTransition } from "react";
import { UserPlus, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toggleFollow, getFollowState } from "@/actions/follow";
import { useAppToast } from "@/hooks/use-app-toast";
import { cn } from "@/lib/utils";
import type { ProfileType } from "@/lib/follows";

export function FollowButton({
  followingUserId,
  profileType,
  locale,
  className,
  size = "sm",
}: {
  followingUserId: string;
  profileType: ProfileType;
  locale: string;
  className?: string;
  size?: "sm" | "default";
}) {
  const appToast = useAppToast();
  const [following, setFollowing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    getFollowState(followingUserId, profileType).then((r) => {
      if (r.success) {
        setFollowing(r.data.following);
      }
      setLoaded(true);
    });
  }, [followingUserId, profileType]);

  return (
    <Button
      type="button"
      size={size}
      variant={following ? "outline" : "neon"}
      disabled={pending || !loaded}
      className={cn(
        "transition-all duration-300 hover:shadow-[0_0_20px_-4px_rgba(168,85,247,0.45)]",
        following && "border-neon-purple/40 bg-neon-purple/10",
        className
      )}
      onClick={() =>
        startTransition(async () => {
          const r = await toggleFollow(followingUserId, profileType);
          if (r.success) {
            setFollowing(r.data.following);
          } else if (r.error === "Unauthorized") {
            window.location.href = `/${locale}/login`;
          } else {
            appToast.error(r.error);
          }
        })
      }
    >
      {following ? (
        <>
          <UserCheck className="h-4 w-4 mr-1.5" />
          Following
        </>
      ) : (
        <>
          <UserPlus className="h-4 w-4 mr-1.5" />
          Follow
        </>
      )}
    </Button>
  );
}
