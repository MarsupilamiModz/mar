"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { attemptSessionRecovery } from "@/lib/session-recovery";

/** Refreshes server components only on meaningful auth transitions (logout). */
export function AuthSync() {
  const router = useRouter();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (!mountedRef.current) return;

      // Ignore passive/no-op events — these caused refresh loops on every page load.
      if (
        event === "INITIAL_SESSION" ||
        event === "TOKEN_REFRESHED" ||
        event === "USER_UPDATED" ||
        event === "PASSWORD_RECOVERY" ||
        event === "MFA_CHALLENGE_VERIFIED"
      ) {
        return;
      }

      if (event === "SIGNED_IN") {
        // Login form and OAuth callback already navigate; avoid double reload.
        const path = window.location.pathname;
        if (path.includes("/login") || path.includes("/register") || path.includes("/api/auth")) {
          return;
        }
        router.refresh();
        return;
      }

      if (event === "SIGNED_OUT") {
        router.refresh();
      }
    });

    const onOnline = () => {
      void attemptSessionRecovery().then((recovered) => {
        if (recovered && mountedRef.current) router.refresh();
      });
    };

    window.addEventListener("online", onOnline);
    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
      window.removeEventListener("online", onOnline);
    };
  }, [router]);

  return null;
}
