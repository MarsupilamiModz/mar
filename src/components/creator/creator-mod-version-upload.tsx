"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { finalizeModVersionUpload } from "@/actions/mods";
import {
  useR2MultipartUpload,
  formatUploadSpeed,
  formatEta,
} from "@/hooks/use-r2-multipart-upload";
import { formatUploadErrorMessage } from "@/lib/upload-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { MAX_UPLOAD_BYTES, MOD_VERSION_FILE_ACCEPT, uploadLimitLabel, logUploadDiagnostic } from "@/lib/upload-limits";

export function CreatorModVersionUpload({ modId }: { modId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [diagnostics, setDiagnostics] = useState<string | null>(null);
  const { upload, abort, pause, resume, retry, progress, uploading, paused, error, speedBps, etaSeconds, chunkStatus } =
    useR2MultipartUpload();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const busy = pending || uploading;

  return (
    <Card className="glass space-y-4 p-6">
      <h3 className="font-medium">Upload version</h3>
      <p className="text-xs text-muted-foreground">
        Direct-to-storage multipart upload — up to {uploadLimitLabel()}. Files never pass through the app server.
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
          if (file.size > MAX_UPLOAD_BYTES) {
            toast({ title: `Max ${uploadLimitLabel()}`, variant: "destructive" });
            return;
          }

          startTransition(async () => {
            try {
              logUploadDiagnostic("upload_start", { modId, fileName: file.name, fileSize: file.size });
              const uploadResult = await upload({
                file,
                purpose: "mod-version",
                modId,
              });
              const sid =
                uploadResult && typeof uploadResult === "object" && "sessionId" in uploadResult
                  ? String(uploadResult.sessionId)
                  : null;
              if (!sid) throw new Error("Upload session missing");
              setSessionId(sid);

              const r = await finalizeModVersionUpload(sid, {
                version,
                changelog: String(fd.get("changelog") ?? "") || undefined,
                gameVersion: String(fd.get("gameVersion") ?? "") || undefined,
                channel: String(fd.get("channel") ?? "STABLE"),
              });

              if (r.success) {
                logUploadDiagnostic("upload_finalize_ok", { modId, sessionId: sid, version });
                const msg =
                  r.data && "message" in r.data
                    ? String(r.data.message)
                    : r.data && "scanStatus" in r.data && r.data.scanStatus !== "CLEAN"
                      ? `Uploaded — ${r.data.scanStatus}`
                      : "Version uploaded";
                toast({ title: msg });
                formRef.current?.reset();
                setSelectedFile(null);
                setSessionId(null);
                router.refresh();
              } else {
                toast({ title: "Error", description: r.error, variant: "destructive" });
              }
            } catch (err) {
              logUploadDiagnostic("upload_failed", {
                modId,
                error: err instanceof Error ? err.message : String(err),
              });
              toast({
                title: "Upload failed",
                description: formatUploadErrorMessage(err),
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
          accept={MOD_VERSION_FILE_ACCEPT}
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
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {progress}% · {formatUploadSpeed(speedBps)} · chunks {chunkStatus.completed}/{chunkStatus.total || "—"}
              </span>
              <span>ETA {formatEta(etaSeconds)}</span>
            </div>
          </div>
        )}
        {error && (
          <div className="space-y-2">
            <p className="text-xs text-destructive">{error}</p>
            {!uploading && (
              <Button type="button" variant="outline" size="sm" onClick={() => void retry()}>
                Retry upload
              </Button>
            )}
          </div>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={() => {
            try {
              const raw = sessionStorage.getItem("xumari-upload-diagnostics");
              setDiagnostics(raw ? JSON.stringify(JSON.parse(raw), null, 2) : "No upload logs yet.");
            } catch {
              setDiagnostics("Could not read upload logs.");
            }
          }}
        >
          Show upload diagnostics
        </Button>
        {diagnostics && (
          <pre className="text-[10px] max-h-40 overflow-auto rounded border border-border/40 p-2 bg-background/50">
            {diagnostics}
          </pre>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="neon" disabled={busy}>
            {uploading ? (paused ? "Paused…" : "Uploading…") : pending ? "Processing…" : "Upload version"}
          </Button>
          {uploading && !paused && (
            <Button type="button" variant="outline" onClick={() => pause()}>
              Pause
            </Button>
          )}
          {uploading && paused && (
            <Button type="button" variant="outline" onClick={() => resume()}>
              Resume
            </Button>
          )}
          {(uploading || sessionId) && (
            <Button
              type="button"
              variant="destructive"
              onClick={() => void abort(sessionId ?? undefined)}
            >
              Cancel
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}
