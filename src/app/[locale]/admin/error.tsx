"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logAdminClientError } from "@/actions/admin/media-repair";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams();
  const pathname = usePathname();
  const locale = (params?.locale as string) ?? "en";

  useEffect(() => {
    console.error("[admin-error]", error);
    void logAdminClientError({
      context: "admin-page",
      message: error.message,
      route: pathname,
      digest: error.digest,
    }).catch(() => undefined);
  }, [error, pathname]);

  const hint =
    error.message.includes("BigInt") || error.message.includes("serialize")
      ? "A server data serialization issue occurred. Try refreshing — if this persists, run Media Repair in Admin → Media Center."
      : error.message.includes("Select")
        ? "A form failed to load required options (games, authors, or categories). Ensure games and creators exist."
        : null;

  return (
    <div className="mx-auto flex min-h-[40vh] max-w-lg flex-col items-center justify-center px-4 py-12 text-center">
      <AlertTriangle className="mb-4 h-12 w-12 text-destructive" />
      <h1 className="text-xl font-bold">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {hint ?? "This admin section could not load. Details were logged to System Health → Error logs."}
      </p>
      {error.message && (
        <p className="mt-3 text-xs text-muted-foreground/80 max-w-md break-words font-mono">
          {error.message}
        </p>
      )}
      {error.digest && (
        <p className="mt-2 text-xs font-mono text-muted-foreground/60">Ref: {error.digest}</p>
      )}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button variant="neon" onClick={() => reset()}>
          Try again
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/${locale}/admin/media`}>Media Center</Link>
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
