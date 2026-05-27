"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createExclusiveProgram } from "@/actions/exclusive";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useAppToast } from "@/hooks/use-app-toast";
import type { ExclusiveProgramType } from "@prisma/client";

type ModOption = { id: string; title: string; slug: string };

export function ExclusiveProgramForm({
  locale,
  mods,
}: {
  locale: string;
  mods: ModOption[];
}) {
  const router = useRouter();
  const appToast = useAppToast();
  const [pending, startTransition] = useTransition();
  const [modId, setModId] = useState(mods[0]?.id ?? "");
  const [type, setType] = useState<ExclusiveProgramType>("CLOSED_BETA");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [maxSlots, setMaxSlots] = useState("");
  const [waitlistEnabled, setWaitlistEnabled] = useState(true);
  const [ndaRequired, setNdaRequired] = useState(false);
  const [discordRequired, setDiscordRequired] = useState(false);

  const submit = () => {
    if (!modId || !title.trim()) {
      appToast.error("Mod and title are required");
      return;
    }
    startTransition(async () => {
      const result = await createExclusiveProgram({
        modId,
        type,
        title: title.trim(),
        description: description.trim() || undefined,
        maxSlots: maxSlots ? Number(maxSlots) : undefined,
        waitlistEnabled,
        ndaRequired,
        discordRequired,
      });
      if (result.success) {
        appToast.saved();
        router.push(`/${locale}/creator/exclusive/${result.data.id}`);
      } else {
        appToast.error(result.error);
      }
    });
  };

  if (mods.length === 0) {
    return (
      <Card className="glass p-8 text-center text-muted-foreground">
        Upload a mod first before launching an exclusive access program.
      </Card>
    );
  }

  return (
    <Card className="glass p-6 space-y-5 max-w-xl">
      <div>
        <label className="text-sm font-medium">Mod</label>
        <select
          value={modId}
          onChange={(e) => setModId(e.target.value)}
          className="mt-1 w-full h-10 rounded-md border border-input bg-background/50 px-3 text-sm"
        >
          {mods.map((m) => (
            <option key={m.id} value={m.id}>{m.title}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-sm font-medium">Program type</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as ExclusiveProgramType)}
          className="mt-1 w-full h-10 rounded-md border border-input bg-background/50 px-3 text-sm"
        >
          <option value="CLOSED_ALPHA">Closed Alpha</option>
          <option value="CLOSED_BETA">Closed Beta</option>
          <option value="INVITE_ONLY">Invite Only</option>
        </select>
      </div>
      <div>
        <label className="text-sm font-medium">Title</label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
      </div>
      <div>
        <label className="text-sm font-medium">Description</label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" rows={4} />
      </div>
      <div>
        <label className="text-sm font-medium">Max slots (optional)</label>
        <Input type="number" min={1} value={maxSlots} onChange={(e) => setMaxSlots(e.target.value)} className="mt-1" />
      </div>
      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={waitlistEnabled} onCheckedChange={setWaitlistEnabled} />
          Waitlist when full
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={ndaRequired} onCheckedChange={setNdaRequired} />
          NDA required
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={discordRequired} onCheckedChange={setDiscordRequired} />
          Discord required
        </label>
      </div>
      <Button variant="neon" disabled={pending} onClick={submit}>
        Launch program
      </Button>
    </Card>
  );
}
