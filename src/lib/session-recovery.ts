"use client";

import { createClient } from "@/lib/supabase/client";

let recoveryPromise: Promise<boolean> | null = null;

async function runSessionRecovery(): Promise<boolean> {
  try {
    const meRes = await fetch("/api/auth/me", {
      credentials: "include",
      cache: "no-store",
    });
    if (meRes.ok) {
      const data = (await meRes.json()) as { id?: string; sessionActive?: boolean; prismaLinked?: boolean } | null;
      if (data?.id) return true;
      if (data === null) return false;
    }
  } catch {
    /* continue to refresh */
  }

  try {
    const supabase = createClient();
    const { data, error } = await supabase.auth.refreshSession();
    if (error || !data.session) return false;

    const meRes = await fetch("/api/auth/me", {
      credentials: "include",
      cache: "no-store",
    });
    if (!meRes.ok) return false;
    const dataMe = (await meRes.json()) as { id?: string } | null;
    return Boolean(dataMe?.id);
  } catch {
    return false;
  }
}

export async function attemptSessionRecovery(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!recoveryPromise) {
    recoveryPromise = runSessionRecovery().finally(() => {
      recoveryPromise = null;
    });
  }
  return recoveryPromise;
}

export function redirectToLogin(returnPath?: string) {
  const path = returnPath ?? `${window.location.pathname}${window.location.search}`;
  const locale = window.location.pathname.split("/")[1] ?? "en";
  window.location.assign(`/${locale}/login?redirect=${encodeURIComponent(path)}`);
}
