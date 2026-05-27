"use client";

import { useState, useTransition } from "react";
import { savePermissionGroup } from "@/actions/admin/branding";
import { PERMISSIONS, type PermissionKey } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAppToast } from "@/hooks/use-app-toast";

type Group = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  permissions: unknown;
  isSystem: boolean;
};

export function GroupsAdminPanel({ groups }: { groups: Group[] }) {
  const appToast = useAppToast();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<Group | null>(null);
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  const startCreate = () => {
    setEditing(null);
    setSlug("");
    setName("");
    setDescription("");
    setSelected([]);
  };

  const startEdit = (g: Group) => {
    if (g.isSystem) return;
    setEditing(g);
    setSlug(g.slug);
    setName(g.name);
    setDescription(g.description ?? "");
    setSelected(Array.isArray(g.permissions) ? g.permissions.map(String) : []);
  };

  const togglePerm = (key: string) => {
    setSelected((prev) => (prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]));
  };

  const save = () => {
    if (!slug.trim() || !name.trim()) {
      appToast.error("Slug and name required");
      return;
    }
    startTransition(async () => {
      const r = await savePermissionGroup({
        id: editing?.id,
        slug: slug.trim(),
        name: name.trim(),
        description: description.trim() || undefined,
        permissions: selected,
      });
      if (r.success) {
        appToast.saved();
        startCreate();
      } else appToast.error(r.error);
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 grid gap-4 sm:grid-cols-2">
        {groups.map((g) => (
          <Card
            key={g.id}
            className={`glass p-5 space-y-3 ${!g.isSystem ? "cursor-pointer hover:border-neon-purple/30" : ""}`}
            onClick={() => startEdit(g)}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{g.name}</h3>
              {g.isSystem && <Badge variant="outline">System</Badge>}
            </div>
            <p className="text-xs text-muted-foreground font-mono">{g.slug}</p>
            {g.description && <p className="text-sm text-muted-foreground">{g.description}</p>}
            <ul className="text-xs space-y-1">
              {(Array.isArray(g.permissions) ? g.permissions : []).slice(0, 6).map((p) => (
                <li key={String(p)} className="text-neon-blue/80">• {String(p)}</li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      <Card className="glass p-5 space-y-4 h-fit sticky top-24">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{editing ? "Edit group" : "New group"}</h3>
          <Button size="sm" variant="ghost" onClick={startCreate}>Clear</Button>
        </div>
        <Input placeholder="slug" value={slug} onChange={(e) => setSlug(e.target.value)} disabled={!!editing} />
        <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        <div className="max-h-48 overflow-y-auto space-y-1 text-sm">
          {(Object.keys(PERMISSIONS) as PermissionKey[]).map((key) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={selected.includes(key)} onChange={() => togglePerm(key)} />
              <span>{key}</span>
            </label>
          ))}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={selected.includes("*")} onChange={() => togglePerm("*")} />
            <span>* (full access)</span>
          </label>
        </div>
        <Button variant="neon" disabled={pending || !!editing?.isSystem} onClick={save}>
          {editing ? "Update group" : "Create group"}
        </Button>
      </Card>
    </div>
  );
}
