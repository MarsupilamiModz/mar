"use client";

import { createClient } from "@/lib/supabase/client";

let recoveryPromise: Promise<boolean> | null = null;

type MeResponse = {
  id?: string;
  sessionActive?: boolean;
  prismaLinked?: boolean;
} | null;

async function fetchMe(): Promise<MeResponse> {
  const meRes = await fetch("/api/auth/me", {
    credentials: "include",
    cache: "no-store",
  });
  if (!meRes.ok) return null;
  return (await meRes.json()) as MeResponse;
}

function isHealthySession(data: MeResponse): boolean {
  return Boolean(data?.id);
}

async function runSessionRecovery(): Promise<boolean> {
  try {
    const initial = await fetchMe();
    if (isHealthySession(initial)) return false;
    if (initial === null) return false;
  } catch {
    /* continue to refresh */
  }

  try {
    const supabase = createClient();
    const { data, error } = await supabase.auth.refreshSession();
    if (error || !data.session) return false;

    const after = await fetchMe();
    return isHealthySession(after);
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
