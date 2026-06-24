"use client";

import { PageError } from "@/components/error/page-error";

export default function ShopError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <PageError error={error} reset={reset} />;
}
