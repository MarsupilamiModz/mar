"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { saveModCollaborator, removeModCollaborator } from "@/actions/creator/hosting";
import type { ModCollaboratorRole } from "@prisma/client";

const ROLES: ModCollaboratorRole[] = [
  "LEAD_CREATOR",
  "DEVELOPER",
  "SCRIPTER",
  "MODELER",
  "DESIGNER",
  "SOUND_DESIGNER",
  "TESTER",
];

type Collaborator = {
  id: string;
  userId: string;
  role: ModCollaboratorRole;
  revenueShareBps: number;
  user: { username: string; displayName: string | null };
};

export function ModCollaboratorsEditor({
  modId,
  initial,
}: {
  modId: string;
  initial: Collaborator[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [items, setItems] = useState(initial);
  const [form, setForm] = useState({
    userId: "",
    role: "DEVELOPER" as ModCollaboratorRole,
    revenueShareBps: 0,
  });

  const add = () => {
    startTransition(async () => {
      const r = await saveModCollaborator({ modId, ...form });
      if (r.success) {
        toast({ title: "Co-Creator hinzugefügt" });
        router.refresh();
      } else toast({ title: r.error, variant: "destructive" });
    });
  };

  const remove = (userId: string) => {
    startTransition(async () => {
      const r = await removeModCollaborator(modId, userId);
      if (r.success) {
        setItems((list) => list.filter((c) => c.userId !== userId));
        toast({ title: "Entfernt" });
      } else toast({ title: r.error, variant: "destructive" });
    });
  };

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle>Co-Creators</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-2 text-sm">
            <span>
              {c.user.displayName ?? c.user.username} · {c.role} · {c.revenueShareBps / 100}%
            </span>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => remove(c.userId)}>
              Entfernen
            </Button>
          </div>
        ))}
        <div className="grid gap-2 sm:grid-cols-3">
          <Input
            placeholder="User ID"
            value={form.userId}
            onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}
          />
          <Select
            value={form.role}
            onValueChange={(v) => setForm((f) => ({ ...f, role: v as ModCollaboratorRole }))}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            placeholder="Share % (0-100)"
            value={form.revenueShareBps / 100}
            onChange={(e) =>
              setForm((f) => ({ ...f, revenueShareBps: Math.round(Number(e.target.value) * 100) }))
            }
          />
        </div>
        <Button variant="neon" size="sm" disabled={pending || !form.userId} onClick={add}>
          Co-Creator hinzufügen
        </Button>
      </CardContent>
    </Card>
  );
}
