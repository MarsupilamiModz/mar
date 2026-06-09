"use client";

import { useState, useTransition } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

type MissingDep = { id: string; slug: string; title: string };

export function ModDownloadButton({ modId, label }: { modId: string; label: string }) {
  const [pending, startTransition] = useTransition();
  const [missing, setMissing] = useState<MissingDep[] | null>(null);

  function download(skipDeps = false) {
    startTransition(async () => {
      const url = `/api/mods/${modId}/download${skipDeps ? "?skipDeps=1" : ""}`;
      const res = await fetch(url, { method: "POST" });
      const data = await res.json().catch(() => ({}));

      if (res.status === 409 && data.missing) {
        setMissing(data.missing);
        toast({
          title: "Missing dependencies",
          description: "Install required mods first or download them below.",
          variant: "destructive",
        });
        return;
      }

      if (!res.ok) {
        toast({ title: data.error ?? "Download failed", variant: "destructive" });
        return;
      }

      window.location.href = data.url;
    });
  }

  return (
    <div className="flex-1 space-y-2">
      <Button variant="neon" className="w-full" disabled={pending} onClick={() => download()}>
        <Download className="h-4 w-4 mr-2" />
        {label}
      </Button>
      {missing && missing.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          disabled={pending}
          onClick={() => download(true)}
        >
          Download anyway (skip dependency check)
        </Button>
      )}
    </div>
  );
}
