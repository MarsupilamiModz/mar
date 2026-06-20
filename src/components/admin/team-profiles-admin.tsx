"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import {
  deleteTeamDepartment,
  deleteTeamProfile,
  reorderTeamProfiles,
  upsertTeamDepartment,
  upsertTeamProfile,
} from "@/actions/admin/team-profiles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppToast } from "@/hooks/use-app-toast";
import type { TeamRoleGroup, TeamVisibility } from "@prisma/client";

type Department = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  _count: { members: number };
};

type Profile = {
  id: string;
  name: string;
  roleGroup: TeamRoleGroup;
  roleBadge: string | null;
  roleColor: string | null;
  position: string;
  description: string | null;
  email: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  discordUrl: string | null;
  youtubeUrl: string | null;
  twitchUrl: string | null;
  tiktokUrl: string | null;
  instagramUrl: string | null;
  xUrl: string | null;
  websiteUrl: string | null;
  visibility: TeamVisibility;
  sortOrder: number;
  isActive: boolean;
  department: { id: string; name: string; slug: string } | null;
};

export function TeamProfilesAdmin({
  departments,
  profiles,
}: {
  departments: Department[];
  profiles: Profile[];
}) {
  const router = useRouter();
  const appToast = useAppToast();
  const [pending, startTransition] = useTransition();
  const [deptName, setDeptName] = useState("");
  const [deptSlug, setDeptSlug] = useState("");
  const [editing, setEditing] = useState<Profile | null>(null);

  function saveDept() {
    if (!deptName.trim()) return;
    startTransition(async () => {
      const r = await upsertTeamDepartment({
        slug: deptSlug || deptName,
        name: deptName,
      });
      if (r.success) {
        appToast.created();
        setDeptName("");
        setDeptSlug("");
        router.refresh();
      } else appToast.error(r.error);
    });
  }

  function saveProfile(form: FormData) {
    startTransition(async () => {
      const r = await upsertTeamProfile({
        id: editing?.id,
        name: String(form.get("name") ?? ""),
        roleGroup: (form.get("roleGroup") as TeamRoleGroup) || "SUPPORT",
        roleBadge: String(form.get("roleBadge") ?? "") || undefined,
        roleColor: String(form.get("roleColor") ?? "") || undefined,
        position: String(form.get("position") ?? ""),
        description: String(form.get("description") ?? "") || undefined,
        email: String(form.get("email") ?? "") || undefined,
        avatarUrl: String(form.get("avatarUrl") ?? "") || undefined,
        bannerUrl: String(form.get("bannerUrl") ?? "") || undefined,
        discordUrl: String(form.get("discordUrl") ?? "") || undefined,
        youtubeUrl: String(form.get("youtubeUrl") ?? "") || undefined,
        twitchUrl: String(form.get("twitchUrl") ?? "") || undefined,
        tiktokUrl: String(form.get("tiktokUrl") ?? "") || undefined,
        instagramUrl: String(form.get("instagramUrl") ?? "") || undefined,
        xUrl: String(form.get("xUrl") ?? "") || undefined,
        websiteUrl: String(form.get("websiteUrl") ?? "") || undefined,
        departmentId: String(form.get("departmentId") ?? "") || null,
        visibility: (form.get("visibility") as TeamVisibility) || "PUBLIC",
        sortOrder: Number(form.get("sortOrder") ?? 0),
      });
      if (r.success) {
        appToast.saved();
        setEditing(null);
        router.refresh();
      } else appToast.error(r.error);
    });
  }

  function moveProfile(id: string, dir: -1 | 1) {
    const idx = profiles.findIndex((p) => p.id === id);
    if (idx < 0) return;
    const next = [...profiles];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap]!, next[idx]!];
    startTransition(async () => {
      const r = await reorderTeamProfiles(next.map((p) => p.id));
      if (r.success) router.refresh();
      else appToast.error(r.error);
    });
  }

  return (
    <Tabs defaultValue="profiles">
      <TabsList>
        <TabsTrigger value="profiles">Public profiles</TabsTrigger>
        <TabsTrigger value="departments">Departments</TabsTrigger>
      </TabsList>

      <TabsContent value="departments" className="space-y-4 mt-4">
        <Card className="glass p-4 grid gap-3 sm:grid-cols-3">
          <Input placeholder="Department name" value={deptName} onChange={(e) => setDeptName(e.target.value)} />
          <Input placeholder="Slug (optional)" value={deptSlug} onChange={(e) => setDeptSlug(e.target.value)} />
          <Button variant="neon" disabled={pending} onClick={saveDept}>
            <Plus className="h-4 w-4 mr-1" /> Add department
          </Button>
        </Card>
        <div className="space-y-2">
          {departments.map((d) => (
            <div key={d.id} className="flex items-center justify-between glass rounded-lg p-3 border border-border/40">
              <div>
                <p className="font-medium">{d.name}</p>
                <p className="text-xs text-muted-foreground">{d._count.members} members · {d.slug}</p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  if (!window.confirm(`Delete ${d.name}?`)) return;
                  startTransition(async () => {
                    const r = await deleteTeamDepartment(d.id);
                    if (r.success) router.refresh();
                    else appToast.error(r.error);
                  });
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="profiles" className="space-y-4 mt-4">
        <Card className="glass p-4">
          <h3 className="font-medium mb-3">{editing ? "Edit member" : "Add team member"}</h3>
          <form action={saveProfile} className="grid gap-3 sm:grid-cols-2">
            <Input name="name" placeholder="Name" required defaultValue={editing?.name} />
            <select
              name="roleGroup"
              className="flex h-10 rounded-md border border-input bg-background/50 px-3 text-sm"
              defaultValue={editing?.roleGroup ?? "SUPPORT"}
            >
              <option value="OWNER">Owner</option>
              <option value="ADMINISTRATOR">Administrator</option>
              <option value="MANAGER">Manager</option>
              <option value="SUPPORT">Support</option>
              <option value="MODERATOR">Moderator</option>
              <option value="DESIGNER">Designer</option>
              <option value="CREATOR">Creator</option>
            </select>
            <Input name="position" placeholder="Position" required defaultValue={editing?.position} />
            <Input name="roleBadge" placeholder="Role badge" defaultValue={editing?.roleBadge ?? ""} />
            <Input name="roleColor" type="color" placeholder="Role color" defaultValue={editing?.roleColor ?? "#a855f7"} />
            <Textarea
              name="description"
              placeholder="Bio"
              className="sm:col-span-2"
              rows={3}
              defaultValue={editing?.description ?? ""}
            />
            <Input name="email" type="email" placeholder="Email" defaultValue={editing?.email ?? ""} />
            <Input name="avatarUrl" placeholder="Avatar URL" defaultValue={editing?.avatarUrl ?? ""} />
            <Input name="bannerUrl" placeholder="Banner URL" defaultValue={editing?.bannerUrl ?? ""} />
            <Input name="discordUrl" placeholder="Discord URL" defaultValue={editing?.discordUrl ?? ""} />
            <Input name="youtubeUrl" placeholder="YouTube" defaultValue={editing?.youtubeUrl ?? ""} />
            <Input name="twitchUrl" placeholder="Twitch" defaultValue={editing?.twitchUrl ?? ""} />
            <Input name="instagramUrl" placeholder="Instagram" defaultValue={editing?.instagramUrl ?? ""} />
            <Input name="xUrl" placeholder="X / Twitter" defaultValue={editing?.xUrl ?? ""} />
            <Input name="websiteUrl" placeholder="Website" defaultValue={editing?.websiteUrl ?? ""} />
            <select
              name="departmentId"
              className="flex h-10 rounded-md border border-input bg-background/50 px-3 text-sm"
              defaultValue={editing?.department?.id ?? ""}
            >
              <option value="">No department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <select
              name="visibility"
              className="flex h-10 rounded-md border border-input bg-background/50 px-3 text-sm"
              defaultValue={editing?.visibility ?? "PUBLIC"}
            >
              <option value="PUBLIC">Public</option>
              <option value="INTERNAL">Internal only</option>
              <option value="HIDDEN">Hidden</option>
            </select>
            <Input name="sortOrder" type="number" placeholder="Sort order" defaultValue={editing?.sortOrder ?? 0} />
            <div className="sm:col-span-2 flex gap-2">
              <Button type="submit" variant="neon" disabled={pending}>
                {editing ? "Save changes" : "Create member"}
              </Button>
              {editing && (
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </Card>

        <div className="space-y-2">
          {profiles.map((p, i) => (
            <div key={p.id} className="flex flex-wrap items-center gap-2 glass rounded-lg p-3 border border-border/40">
              <div className="flex-1 min-w-0">
                <p className="font-medium">{p.name}</p>
                <p className="text-sm text-muted-foreground">
                  {p.roleGroup} ·{" "}
                  {p.position}
                  {p.department && ` · ${p.department.name}`}
                </p>
              </div>
              {p.roleBadge && <Badge>{p.roleBadge}</Badge>}
              <Badge variant="outline">{p.visibility}</Badge>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" disabled={pending || i === 0} onClick={() => moveProfile(p.id, -1)}>
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={pending || i === profiles.length - 1}
                  onClick={() => moveProfile(p.id, 1)}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(p)}>Edit</Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => {
                    if (!window.confirm(`Delete ${p.name}?`)) return;
                    startTransition(async () => {
                      const r = await deleteTeamProfile(p.id);
                      if (r.success) router.refresh();
                      else appToast.error(r.error);
                    });
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </TabsContent>
    </Tabs>
  );
}
