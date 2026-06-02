"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center p-6 font-sans">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold">Something went wrong</h1>
          <p className="text-sm text-white/60">
            A critical error occurred. Please reload the page or try again.
          </p>
          {error.digest && (
            <p className="text-xs font-mono text-white/40">Reference: {error.digest}</p>
          )}
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium hover:bg-purple-500 transition-colors"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
