"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { attemptSessionRecovery } from "@/lib/session-recovery";

/** Refreshes server components when Supabase auth state changes (login/logout). */
export function AuthSync() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === "SIGNED_IN") {
        window.location.reload();
        return;
      }
      if (event === "TOKEN_REFRESHED") {
        router.refresh();
        return;
      }
      if (event === "SIGNED_OUT") {
        router.refresh();
        return;
      }
      router.refresh();
    });

    const onOnline = () => {
      void attemptSessionRecovery().then((recovered) => {
        if (recovered) router.refresh();
      });
    };

    window.addEventListener("online", onOnline);
    return () => {
      subscription.unsubscribe();
      window.removeEventListener("online", onOnline);
    };
  }, [router]);

  return null;
}
