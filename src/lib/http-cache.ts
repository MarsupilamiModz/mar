import { NextResponse } from "next/server";

export const CACHE_PUBLIC_SHORT = "public, max-age=60, s-maxage=300, stale-while-revalidate=600";
export const CACHE_PUBLIC_MEDIUM = "public, max-age=300, s-maxage=600, stale-while-revalidate=1800";
export const CACHE_PRIVATE_SHORT = "private, max-age=30, stale-while-revalidate=120";
export const CACHE_NO_STORE = "private, no-store";

export function jsonCached<T>(data: T, cacheControl: string, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", cacheControl);
  return NextResponse.json(data, { ...init, headers });
}
