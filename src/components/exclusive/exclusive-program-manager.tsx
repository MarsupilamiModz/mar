"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  reviewExclusiveApplication,
  uploadExclusiveBuild,
  createExclusiveInviteCode,
  toggleExclusiveProgram,
  getExclusiveDownloadUrl,
} from "@/actions/exclusive";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { useAppToast } from "@/hooks/use-app-toast";
import type { ExclusiveApplicationStatus } from "@prisma/client";

type Program = {
  id: string;
  title: string;
  type: string;
  description: string | null;
  maxSlots: number | null;
  currentCount: number;
  isActive: boolean;
  ndaRequired: boolean;
  discordRequired: boolean;
  mod: { title: string; slug: string };
  builds: { id: string; version: string; fileName: string; fileSize: number; expiresAt: Date | null; createdAt: Date }[];
  applications: {
    id: string;
    status: ExclusiveApplicationStatus;
    message: string | null;
    ndaAccepted: boolean;
    inviteCode: string | null;
    createdAt: Date;
    user: { id: string; username: string; displayName: string | null; discordId: string | null };
  }[];
  inviteCodes: { id: string; code: string; maxUses: number; uses: number; expiresAt: Date | null }[];
};

export function ExclusiveProgramManager({ locale, program }: { locale: string; program: Program }) {
  const router = useRouter();
  const appToast = useAppToast();
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const [version, setVersion] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const review = (applicationId: string, status: ExclusiveApplicationStatus) => {
    startTransition(async () => {
      const r = await reviewExclusiveApplication(applicationId, status);
      if (r.success) {
        appToast.saved();
        router.refresh();
      } else appToast.error(r.error);
    });
  };

  const uploadBuild = () => {
    const file = fileRef.current?.files?.[0];
    if (!file || !version.trim()) {
      appToast.error("File and version required");
      return;
    }
    const fd = new FormData();
    fd.set("file", file);
    fd.set("version", version.trim());
    if (expiresAt) fd.set("expiresAt", expiresAt);
    startTransition(async () => {
      const r = await uploadExclusiveBuild(program.id, fd);
      if (r.success) {
        appToast.saved();
        setVersion("");
        setExpiresAt("");
        if (fileRef.current) fileRef.current.value = "";
        router.refresh();
      } else appToast.error(r.error);
    });
  };

  const generateInvite = () => {
    startTransition(async () => {
      const r = await createExclusiveInviteCode(program.id);
      if (r.success) {
        appToast.saved();
        router.refresh();
      } else appToast.error(r.error);
    });
  };

  const downloadBuild = (buildId: string) => {
    startTransition(async () => {
      const r = await getExclusiveDownloadUrl(buildId);
      if (r.success) window.open(r.data.url, "_blank");
      else appToast.error(r.error);
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="premium">{program.type.replace("_", " ")}</Badge>
            <Badge variant={program.isActive ? "free" : "outline"}>{program.isActive ? "Active" : "Inactive"}</Badge>
          </div>
          <h2 className="text-xl font-semibold">{program.title}</h2>
          <p className="text-sm text-muted-foreground">{program.mod.title}</p>
          {program.description && <p className="mt-2 text-sm">{program.description}</p>}
          {program.maxSlots != null && (
            <p className="text-xs text-muted-foreground mt-1">
              {program.currentCount}/{program.maxSlots} slots filled
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={program.isActive}
              onCheckedChange={(v) =>
                startTransition(async () => {
                  const r = await toggleExclusiveProgram(program.id, v);
                  if (r.success) appToast.saved();
                })
              }
            />
            Active
          </label>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/${locale}/exclusive/${program.id}`} target="_blank">
              Public apply page
            </Link>
          </Button>
        </div>
      </div>

      <Card className="glass p-5 space-y-4">
        <h3 className="font-semibold">Private builds</h3>
        <div className="flex flex-wrap gap-2 items-end">
          <Input placeholder="Version e.g. 0.9.1-beta" value={version} onChange={(e) => setVersion(e.target.value)} className="max-w-[180px]" />
          <Input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="max-w-[220px]" />
          <input ref={fileRef} type="file" className="text-sm" />
          <Button variant="neon" size="sm" disabled={pending} onClick={uploadBuild}>Upload build</Button>
        </div>
        {program.builds.length === 0 ? (
          <p className="text-sm text-muted-foreground">No builds uploaded yet.</p>
        ) : (
          <ul className="space-y-2">
            {program.builds.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 text-sm border-b border-border/30 pb-2">
                <span>v{b.version} · {b.fileName} · {(b.fileSize / 1024 / 1024).toFixed(1)} MB</span>
                <Button size="sm" variant="outline" disabled={pending} onClick={() => downloadBuild(b.id)}>
                  Download
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="glass p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Invite codes</h3>
          <Button size="sm" variant="outline" disabled={pending} onClick={generateInvite}>Generate code</Button>
        </div>
        {program.inviteCodes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No invite codes yet.</p>
        ) : (
          <ul className="space-y-1 font-mono text-sm text-neon-blue">
            {program.inviteCodes.map((c) => (
              <li key={c.id}>{c.code} · {c.uses}/{c.maxUses || "∞"} uses</li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="glass p-5 space-y-4">
        <h3 className="font-semibold">Applications ({program.applications.length})</h3>
        {program.applications.length === 0 ? (
          <p className="text-sm text-muted-foreground">No applications yet.</p>
        ) : (
          <ul className="space-y-3">
            {program.applications.map((a) => (
              <li key={a.id} className="rounded-lg border border-border/30 p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{a.user.displayName ?? a.user.username}</span>
                  <Badge variant="outline">{a.status}</Badge>
                  {a.user.discordId && <Badge variant="free">Discord linked</Badge>}
                </div>
                {a.message && <p className="text-sm text-muted-foreground">{a.message}</p>}
                {a.status === "PENDING" || a.status === "WAITLIST" ? (
                  <div className="flex gap-2">
                    <Button size="sm" variant="neon" disabled={pending} onClick={() => review(a.id, "APPROVED")}>Approve</Button>
                    <Button size="sm" variant="outline" disabled={pending} onClick={() => review(a.id, "REJECTED")}>Reject</Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
