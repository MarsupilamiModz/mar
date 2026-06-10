"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { finalizeModVersionUpload } from "@/actions/mods";
import { useR2MultipartUpload } from "@/hooks/use-r2-multipart-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

export function CreatorModVersionUpload({ modId }: { modId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { upload, progress, uploading, error } = useR2MultipartUpload();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const busy = pending || uploading;

  return (
    <Card className="glass space-y-4 p-6">
      <h3 className="font-medium">Upload version</h3>
      <p className="text-xs text-muted-foreground">
        Large files upload directly to storage with resumable multipart transfer.
      </p>
      <form
        ref={formRef}
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const file = selectedFile ?? (fd.get("file") as File | null);
          const version = String(fd.get("version") ?? "").trim();
          if (!file || !version) {
            toast({ title: "File and version required", variant: "destructive" });
            return;
          }
          if (file.size > 500 * 1024 * 1024) {
            toast({ title: "Max 500MB", variant: "destructive" });
            return;
          }

          startTransition(async () => {
            try {
              const uploadResult = await upload({
                file,
                purpose: "mod-version",
                modId,
              });
              const sessionId =
                uploadResult && typeof uploadResult === "object" && "sessionId" in uploadResult
                  ? String(uploadResult.sessionId)
                  : null;
              if (!sessionId) throw new Error("Upload session missing");

              const r = await finalizeModVersionUpload(sessionId, {
                version,
                changelog: String(fd.get("changelog") ?? "") || undefined,
                gameVersion: String(fd.get("gameVersion") ?? "") || undefined,
                channel: String(fd.get("channel") ?? "STABLE"),
              });

              if (r.success) {
                const msg =
                  r.data && "message" in r.data
                    ? String(r.data.message)
                    : r.data && "scanStatus" in r.data && r.data.scanStatus !== "CLEAN"
                      ? `Uploaded — ${r.data.scanStatus}`
                      : "Version uploaded";
                toast({ title: msg });
                formRef.current?.reset();
                setSelectedFile(null);
                router.refresh();
              } else {
                toast({ title: "Error", description: r.error, variant: "destructive" });
              }
            } catch (err) {
              toast({
                title: "Upload failed",
                description: err instanceof Error ? err.message : "Unknown error",
                variant: "destructive",
              });
            }
          });
        }}
        className="space-y-3"
      >
        <Input name="version" placeholder="1.0.0" required />
        <Input name="gameVersion" placeholder="Game version (optional)" />
        <select
          name="channel"
          className="h-10 w-full rounded-md border border-input bg-background/50 px-3 text-sm"
        >
          <option value="STABLE">Stable release</option>
          <option value="BETA">Beta release</option>
        </select>
        <Textarea name="changelog" placeholder="Changelog" rows={3} />
        <Input
          name="file"
          type="file"
          required
          onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
        />
        {(uploading || progress > 0) && (
          <div className="space-y-1">
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-neon-purple transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">{progress}% uploaded</p>
          </div>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Button type="submit" variant="neon" disabled={busy}>
          {uploading ? "Uploading…" : pending ? "Processing…" : "Upload version"}
        </Button>
      </form>
    </Card>
  );
}
