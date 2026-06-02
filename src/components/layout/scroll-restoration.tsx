"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function scrollStorageKey(pathname: string, search: string) {
  return `scroll:${pathname}${search ? `?${search}` : ""}`;
}

function ScrollRestorationInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const prevKey = useRef<string | null>(null);

  useEffect(() => {
    const key = scrollStorageKey(pathname, search);
    const saved = sessionStorage.getItem(key);
    if (saved) {
      requestAnimationFrame(() => window.scrollTo({ top: Number(saved), behavior: "instant" as ScrollBehavior }));
    }

    prevKey.current = key;
  }, [pathname, search]);

  useEffect(() => {
    const save = () => {
      if (prevKey.current) {
        sessionStorage.setItem(prevKey.current, String(window.scrollY));
      }
    };
    window.addEventListener("pagehide", save);
    return () => {
      save();
      window.removeEventListener("pagehide", save);
    };
  }, []);

  return null;
}

export function ScrollRestoration() {
  return (
    <Suspense fallback={null}>
      <ScrollRestorationInner />
    </Suspense>
  );
}
