"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAppToast } from "@/hooks/use-app-toast";
import { saveAchievement, deleteAchievement } from "@/actions/admin/achievements";
import { AchievementBadge } from "@/components/achievements/achievement-badge";
import type { AchievementCategory, AchievementRarity } from "@prisma/client";

type Achievement = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  title: string | null;
  category: AchievementCategory;
  rarity: AchievementRarity;
  icon: string | null;
  xpReward: number;
  isHidden: boolean;
  isSeasonal: boolean;
  animated: boolean;
  glowEffect: boolean;
  isActive: boolean;
};

export function AchievementsAdminPanel({ achievements }: { achievements: Achievement[] }) {
  const router = useRouter();
  const appToast = useAppToast();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<Achievement | null>(null);

  const save = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await saveAchievement({
        id: editing?.id,
        slug: (fd.get("slug") as string) || undefined,
        name: fd.get("name") as string,
        description: (fd.get("description") as string) || undefined,
        title: (fd.get("title") as string) || undefined,
        category: fd.get("category") as AchievementCategory,
        rarity: fd.get("rarity") as AchievementRarity,
        icon: (fd.get("icon") as string) || undefined,
        xpReward: Number(fd.get("xpReward")),
        isHidden: fd.get("isHidden") === "on",
        isSeasonal: fd.get("isSeasonal") === "on",
        animated: fd.get("animated") === "on",
        glowEffect: fd.get("glowEffect") === "on",
        isActive: fd.get("isActive") === "on",
      });
      if (r.success) { appToast.saved(); setEditing(null); router.refresh(); }
      else appToast.error(r.error);
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{achievements.length} achievements</p>
        <Button variant="outline" size="sm" onClick={() => setEditing({} as Achievement)}>New achievement</Button>
      </div>

      {editing && (
        <Card className="glass p-6">
          <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
            <Input name="slug" defaultValue={editing.slug} placeholder="slug" required disabled={!!editing.id} />
            <Input name="name" defaultValue={editing.name} placeholder="Name" required />
            <Input name="title" defaultValue={editing.title ?? ""} placeholder="Title reward" />
            <Input name="icon" defaultValue={editing.icon ?? "🏅"} placeholder="Icon emoji" />
            <select name="category" defaultValue={editing.category ?? "USER"} className="h-10 rounded-md border border-input bg-background/50 px-3 text-sm">
              {(["USER", "CREATOR", "PARTNER", "SEASONAL", "HIDDEN"] as const).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select name="rarity" defaultValue={editing.rarity ?? "COMMON"} className="h-10 rounded-md border border-input bg-background/50 px-3 text-sm">
              {(["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY"] as const).map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <Input name="xpReward" type="number" defaultValue={editing.xpReward ?? 100} />
            <Textarea name="description" defaultValue={editing.description ?? ""} className="sm:col-span-2" rows={2} />
            <label className="flex gap-2 text-sm"><input type="checkbox" name="isHidden" defaultChecked={editing.isHidden} /> Hidden</label>
            <label className="flex gap-2 text-sm"><input type="checkbox" name="isSeasonal" defaultChecked={editing.isSeasonal} /> Seasonal</label>
            <label className="flex gap-2 text-sm"><input type="checkbox" name="animated" defaultChecked={editing.animated} /> Animated</label>
            <label className="flex gap-2 text-sm"><input type="checkbox" name="glowEffect" defaultChecked={editing.glowEffect ?? true} /> Glow</label>
            <label className="flex gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={editing.isActive ?? true} /> Active</label>
            <div className="sm:col-span-2 flex gap-2">
              <Button type="submit" variant="neon" disabled={pending}>Save</Button>
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {achievements.map((a) => (
          <Card key={a.id} className="glass p-4 flex gap-3">
            <AchievementBadge name={a.name} icon={a.icon} rarity={a.rarity} animated={a.animated} glowEffect={a.glowEffect} />
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{a.name}</p>
              <Badge variant="outline" className="text-[10px] mt-1">{a.category}</Badge>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.description}</p>
              <div className="flex gap-1 mt-2">
                <Button size="sm" variant="outline" onClick={() => setEditing(a)}>Edit</Button>
                <Button size="sm" variant="ghost" className="text-destructive" disabled={pending} onClick={() => startTransition(async () => {
                  if (!confirm("Delete?")) return;
                  const r = await deleteAchievement(a.id);
                  if (r.success) router.refresh();
                })}>Del</Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
