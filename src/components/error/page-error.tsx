"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

const DEFAULT_LABELS = {
  title: "Something went wrong",
  hint: "An unexpected error occurred. Please try again.",
  retry: "Try again",
};

type Labels = Partial<typeof DEFAULT_LABELS>;

export function PageError({
  error,
  reset,
  labels,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  labels?: Labels;
}) {
  const copy = { ...DEFAULT_LABELS, ...labels };

  useEffect(() => {
    console.error("[page-error]", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <AlertTriangle className="mb-4 h-12 w-12 text-destructive" />
      <h1 className="text-2xl font-bold">{copy.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{copy.hint}</p>
      {error.digest && (
        <p className="mt-2 text-xs font-mono text-muted-foreground/70">{error.digest}</p>
      )}
      <Button variant="neon" className="mt-6" onClick={() => reset()}>
        {copy.retry}
      </Button>
    </div>
  );
}
