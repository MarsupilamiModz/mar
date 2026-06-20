"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SystemHealthSnapshot } from "@/lib/system-health-monitor";

const POLL_MS = 15_000;

export function useSystemHealthRealtime(initial: SystemHealthSnapshot) {
  const [snapshot, setSnapshot] = useState(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch("/api/admin/health", { cache: "no-store" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Health check failed (${res.status})`);
      }
      const data = (await res.json()) as SystemHealthSnapshot;
      if (mountedRef.current) {
        setSnapshot(data);
        setLastError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setLastError(err instanceof Error ? err.message : "Refresh failed");
      }
    } finally {
      if (mountedRef.current && !silent) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const timer = window.setInterval(() => {
      void refresh(true);
    }, POLL_MS);

    return () => {
      mountedRef.current = false;
      window.clearInterval(timer);
    };
  }, [refresh]);

  return { snapshot, refreshing, lastError, refresh };
}
