"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams();
  const locale = (params?.locale as string) ?? "en";

  useEffect(() => {
    console.error("[admin-error]", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[40vh] max-w-lg flex-col items-center justify-center px-4 py-12 text-center">
      <AlertTriangle className="mb-4 h-12 w-12 text-destructive" />
      <h1 className="text-xl font-bold">Admin page error</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This admin section failed to load. Your other admin tools should still work.
      </p>
      {error.message && (
        <p className="mt-3 text-xs text-muted-foreground/80 max-w-md break-words">{error.message}</p>
      )}
      {error.digest && (
        <p className="mt-2 text-xs font-mono text-muted-foreground/60">Ref: {error.digest}</p>
      )}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button variant="neon" onClick={() => reset()}>
          Try again
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/${locale}/admin`}>Back to overview</Link>
        </Button>
        <Button variant="ghost" asChild>
          <Link href={`/${locale}/admin/system`}>System logs</Link>
        </Button>
      </div>
    </div>
  );
}
