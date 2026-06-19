"use client";

import { useEffect, useRef } from "react";

/** Fire-and-forget daily visit ping — keeps locale layout static. */
export function PlatformVisitTracker() {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    void fetch("/api/platform/visit", { method: "POST", keepalive: true });
  }, []);

  return null;
}
