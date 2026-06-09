"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { uploadModVersion } from "@/actions/mods";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

export function CreatorModVersionUpload({ modId }: { modId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Card className="glass space-y-4 p-6">
      <h3 className="font-medium">Upload version</h3>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          startTransition(async () => {
            const r = await uploadModVersion(modId, fd);
            if (r.success) {
              const msg =
                r.data && "message" in r.data
                  ? String(r.data.message)
                  : r.data && "scanStatus" in r.data && r.data.scanStatus !== "CLEAN"
                    ? `Uploaded — ${r.data.scanStatus}`
                    : "Version uploaded";
              toast({ title: msg });
              router.refresh();
            } else toast({ title: "Error", description: r.error, variant: "destructive" });
          });
        }}
        className="space-y-3"
      >
        <Input name="version" placeholder="1.0.0" required />
        <Input name="gameVersion" placeholder="Game version (optional)" />
        <select name="channel" className="h-10 w-full rounded-md border border-input bg-background/50 px-3 text-sm">
          <option value="STABLE">Stable release</option>
          <option value="BETA">Beta release</option>
        </select>
        <Textarea name="changelog" placeholder="Changelog" rows={3} />
        <Input name="file" type="file" required />
        <Button type="submit" variant="neon" disabled={pending}>
          Upload version
        </Button>
      </form>
    </Card>
  );
}
