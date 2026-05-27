"use client";

import { useState, useTransition } from "react";
import { applyToExclusiveProgram } from "@/actions/exclusive";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useAppToast } from "@/hooks/use-app-toast";

type Program = {
  id: string;
  title: string;
  type: string;
  description: string | null;
  maxSlots: number | null;
  currentCount: number;
  waitlistEnabled: boolean;
  ndaRequired: boolean;
  discordRequired: boolean;
  mod: { title: string; slug: string; game: { name: string } };
  author: { username: string; displayName: string | null };
};

type Application = {
  status: string;
} | null;

export function ExclusiveApplyForm({
  program,
  existingApplication,
}: {
  program: Program;
  existingApplication: Application;
}) {
  const appToast = useAppToast();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [ndaAccepted, setNdaAccepted] = useState(false);

  if (existingApplication) {
    return (
      <Card className="glass p-6 text-center space-y-2">
        <Badge variant="premium">{existingApplication.status}</Badge>
        <p className="text-sm text-muted-foreground">
          You have already applied to this program. Status: {existingApplication.status.replace("_", " ")}
        </p>
      </Card>
    );
  }

  const submit = () => {
    const fd = new FormData();
    fd.set("message", message);
    fd.set("inviteCode", inviteCode);
    fd.set("ndaAccepted", String(ndaAccepted));
    startTransition(async () => {
      const r = await applyToExclusiveProgram(program.id, fd);
      if (r.success) appToast.saved();
      else appToast.error(r.error);
    });
  };

  const atCapacity = program.maxSlots != null && program.currentCount >= program.maxSlots;

  return (
    <Card className="glass p-6 space-y-4 max-w-lg">
      <div className="flex flex-wrap gap-2">
        <Badge variant="premium">{program.type.replace("_", " ")}</Badge>
        {atCapacity && program.waitlistEnabled && <Badge variant="outline">Waitlist open</Badge>}
        {program.maxSlots != null && (
          <Badge variant="outline">{program.currentCount}/{program.maxSlots} slots</Badge>
        )}
      </div>
      <h2 className="text-xl font-semibold">{program.title}</h2>
      <p className="text-sm text-muted-foreground">
        {program.mod.title} · {program.mod.game.name} · by {program.author.displayName ?? program.author.username}
      </p>
      {program.description && <p className="text-sm">{program.description}</p>}

      {program.discordRequired && (
        <p className="text-xs text-amber-400">Discord account must be linked in your settings.</p>
      )}

      <div>
        <label className="text-sm font-medium">Why do you want access?</label>
        <Textarea value={message} onChange={(e) => setMessage(e.target.value)} className="mt-1" rows={4} />
      </div>

      <div>
        <label className="text-sm font-medium">Invite code (optional)</label>
        <Input value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} className="mt-1 font-mono" placeholder="EX-XXXXXXXX" />
      </div>

      {program.ndaRequired && (
        <label className="flex items-start gap-2 text-sm">
          <Switch checked={ndaAccepted} onCheckedChange={setNdaAccepted} />
          <span>I accept the NDA and agree not to share builds or details publicly.</span>
        </label>
      )}

      <Button variant="neon" disabled={pending} onClick={submit} className="w-full">
        {atCapacity && program.waitlistEnabled ? "Join waitlist" : "Apply for access"}
      </Button>
    </Card>
  );
}
