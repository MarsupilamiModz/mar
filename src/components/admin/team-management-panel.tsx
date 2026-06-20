"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  Link2,
  Plus,
  Search,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import {
  deleteTeamDepartment,
  deleteTeamProfile,
  reorderTeamProfiles,
  searchUsersForTeamProfile,
  upsertTeamDepartment,
  upsertTeamProfile,
} from "@/actions/admin/team-profiles";
import { TeamMemberMediaUpload } from "@/components/admin/team-member-media-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SafeImage } from "@/components/ui/safe-image";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppToast } from "@/hooks/use-app-toast";
import { TEAM_ROLE_GROUPS, teamRoleColor, teamRoleTitle } from "@/lib/team-page";
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

type LinkedUser = {
  id: string;
  username: string;
  displayName: string | null;
  email: string;
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
  customLinks: unknown;
  visibility: TeamVisibility;
  sortOrder: number;
  isActive: boolean;
  userId: string | null;
  department: { id: string; name: string; slug: string } | null;
  user: LinkedUser | null;
};

type CustomLink = { label: string; url: string };

type FormState = {
  name: string;
  roleGroup: TeamRoleGroup;
  roleBadge: string;
  roleColor: string;
  position: string;
  description: string;
  email: string;
  avatarUrl: string;
  bannerUrl: string;
  discordUrl: string;
  youtubeUrl: string;
  twitchUrl: string;
  tiktokUrl: string;
  instagramUrl: string;
  xUrl: string;
  websiteUrl: string;
  departmentId: string;
  visibility: TeamVisibility;
  sortOrder: number;
  isActive: boolean;
  userId: string | null;
  customLinks: CustomLink[];
};

const EMPTY_FORM: FormState = {
  name: "",
  roleGroup: "SUPPORT",
  roleBadge: "",
  roleColor: "#a855f7",
  position: "",
  description: "",
  email: "",
  avatarUrl: "",
  bannerUrl: "",
  discordUrl: "",
  youtubeUrl: "",
  twitchUrl: "",
  tiktokUrl: "",
  instagramUrl: "",
  xUrl: "",
  websiteUrl: "",
  departmentId: "",
  visibility: "PUBLIC",
  sortOrder: 0,
  isActive: true,
  userId: null,
  customLinks: [],
};

function parseCustomLinks(value: unknown): CustomLink[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is CustomLink =>
      typeof entry === "object" &&
      entry !== null &&
      typeof (entry as CustomLink).label === "string" &&
      typeof (entry as CustomLink).url === "string"
  );
}

function profileToForm(profile: Profile): FormState {
  return {
    name: profile.name,
    roleGroup: profile.roleGroup,
    roleBadge: profile.roleBadge ?? "",
    roleColor: profile.roleColor ?? teamRoleColor(profile.roleGroup),
    position: profile.position,
    description: profile.description ?? "",
    email: profile.email ?? "",
    avatarUrl: profile.avatarUrl ?? "",
    bannerUrl: profile.bannerUrl ?? "",
    discordUrl: profile.discordUrl ?? "",
    youtubeUrl: profile.youtubeUrl ?? "",
    twitchUrl: profile.twitchUrl ?? "",
    tiktokUrl: profile.tiktokUrl ?? "",
    instagramUrl: profile.instagramUrl ?? "",
    xUrl: profile.xUrl ?? "",
    websiteUrl: profile.websiteUrl ?? "",
    departmentId: profile.department?.id ?? "",
    visibility: profile.visibility,
    sortOrder: profile.sortOrder,
    isActive: profile.isActive,
    userId: profile.userId,
    customLinks: parseCustomLinks(profile.customLinks),
  };
}

export function TeamManagementPanel({
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [linkedUser, setLinkedUser] = useState<LinkedUser | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState<
    Array<LinkedUser & { avatarUrl: string | null }>
  >([]);

  const editing = useMemo(
    () => (editingId ? profiles.find((p) => p.id === editingId) ?? null : null),
    [editingId, profiles]
  );

  const isEditing = editingId !== null;

  function startCreate() {
    setEditingId("new");
    setForm({ ...EMPTY_FORM, sortOrder: profiles.length });
    setLinkedUser(null);
    setUserSearch("");
    setUserResults([]);
  }

  function startEdit(profile: Profile) {
    setEditingId(profile.id);
    setForm(profileToForm(profile));
    setLinkedUser(profile.user);
    setUserSearch("");
    setUserResults([]);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setLinkedUser(null);
    setUserSearch("");
    setUserResults([]);
  }

  function patchForm(patch: Partial<FormState>) {
    setForm((current) => ({ ...current, ...patch }));
  }

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

  function saveProfile() {
    if (!form.name.trim() || !form.position.trim()) {
      appToast.error("Name and position are required");
      return;
    }

    startTransition(async () => {
      const r = await upsertTeamProfile({
        id: editing && editingId !== "new" ? editing.id : undefined,
        name: form.name,
        roleGroup: form.roleGroup,
        roleBadge: form.roleBadge || undefined,
        roleColor: form.roleColor || undefined,
        position: form.position,
        description: form.description || undefined,
        email: form.email || undefined,
        avatarUrl: form.avatarUrl || undefined,
        bannerUrl: form.bannerUrl || undefined,
        discordUrl: form.discordUrl || undefined,
        youtubeUrl: form.youtubeUrl || undefined,
        twitchUrl: form.twitchUrl || undefined,
        tiktokUrl: form.tiktokUrl || undefined,
        instagramUrl: form.instagramUrl || undefined,
        xUrl: form.xUrl || undefined,
        websiteUrl: form.websiteUrl || undefined,
        customLinks: form.customLinks.filter((link) => link.label.trim() && link.url.trim()),
        departmentId: form.departmentId || null,
        visibility: form.visibility,
        sortOrder: form.sortOrder,
        isActive: form.isActive,
        userId: form.userId,
      });

      if (r.success) {
        appToast.saved();
        cancelEdit();
        router.refresh();
      } else appToast.error(r.error);
    });
  }

  function removeProfile(id: string, name: string) {
    if (!window.confirm(`Remove ${name} from the team page?`)) return;
    startTransition(async () => {
      const r = await deleteTeamProfile(id);
      if (r.success) {
        if (editingId === id) cancelEdit();
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

  function searchUsers() {
    if (userSearch.trim().length < 2) return;
    startTransition(async () => {
      const r = await searchUsersForTeamProfile(
        userSearch.trim(),
        editing && editingId !== "new" ? editing.id : undefined
      );
      if (r.success) setUserResults(r.data);
      else appToast.error(r.error);
    });
  }

  function linkUser(user: LinkedUser & { avatarUrl?: string | null }) {
    setLinkedUser(user);
    patchForm({
      userId: user.id,
      name: form.name || user.displayName || user.username,
      email: form.email || user.email,
      avatarUrl: form.avatarUrl || user.avatarUrl || "",
    });
    setUserResults([]);
    setUserSearch("");
  }

  function unlinkUser() {
    setLinkedUser(null);
    patchForm({ userId: null });
  }

  return (
    <Tabs defaultValue="members">
      <TabsList>
        <TabsTrigger value="members">Team members</TabsTrigger>
        <TabsTrigger value="departments">Categories</TabsTrigger>
      </TabsList>

      <TabsContent value="departments" className="mt-4 space-y-4">
        <Card className="glass grid gap-3 p-4 sm:grid-cols-3">
          <Input
            placeholder="Category name"
            value={deptName}
            onChange={(e) => setDeptName(e.target.value)}
          />
          <Input
            placeholder="Slug (optional)"
            value={deptSlug}
            onChange={(e) => setDeptSlug(e.target.value)}
          />
          <Button variant="neon" disabled={pending} onClick={saveDept}>
            <Plus className="mr-1 h-4 w-4" /> Add category
          </Button>
        </Card>
        <div className="space-y-2">
          {departments.map((dept) => (
            <div
              key={dept.id}
              className="flex items-center justify-between rounded-lg border border-border/40 p-3 glass"
            >
              <div>
                <p className="font-medium">{dept.name}</p>
                <p className="text-xs text-muted-foreground">
                  {dept._count.members} members · {dept.slug}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  if (!window.confirm(`Delete category ${dept.name}?`)) return;
                  startTransition(async () => {
                    const r = await deleteTeamDepartment(dept.id);
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

      <TabsContent value="members" className="mt-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">
              Manage public team profiles, roles, media, and contact details.
            </p>
          </div>
          {!isEditing && (
            <Button variant="neon" onClick={startCreate}>
              <UserPlus className="mr-2 h-4 w-4" />
              Add team member
            </Button>
          )}
        </div>

        {isEditing && (
          <Card className="glass space-y-6 p-6">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">
                {editingId === "new" ? "Add team member" : `Edit ${form.name}`}
              </h3>
              <Button type="button" variant="ghost" size="icon" onClick={cancelEdit}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <section className="space-y-3">
              <h4 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                Identity
              </h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  placeholder="Display name"
                  value={form.name}
                  onChange={(e) => patchForm({ name: e.target.value })}
                />
                <Input
                  placeholder="Position title"
                  value={form.position}
                  onChange={(e) => patchForm({ position: e.target.value })}
                />
              </div>

              <div className="space-y-2 rounded-lg border border-border/40 p-3">
                <p className="text-sm font-medium">Link platform user (optional)</p>
                {linkedUser ? (
                  <div className="flex items-center justify-between gap-2 rounded-md bg-muted/30 px-3 py-2">
                    <div>
                      <p className="font-medium">{linkedUser.displayName || linkedUser.username}</p>
                      <p className="text-xs text-muted-foreground">{linkedUser.email}</p>
                    </div>
                    <Button type="button" size="sm" variant="outline" onClick={unlinkUser}>
                      Unlink
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Search username or email…"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={pending || userSearch.trim().length < 2}
                      onClick={searchUsers}
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                {userResults.length > 0 && (
                  <div className="space-y-1">
                    {userResults.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-muted/40"
                        onClick={() => linkUser(user)}
                      >
                        <div className="relative h-8 w-8 overflow-hidden rounded-full bg-muted">
                          <SafeImage src={user.avatarUrl} alt="" fill className="object-cover" sizes="32px" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{user.displayName || user.username}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="space-y-3">
              <h4 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                Role & category
              </h4>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <select
                  className="flex h-10 rounded-md border border-input bg-background/50 px-3 text-sm"
                  value={form.roleGroup}
                  onChange={(e) =>
                    patchForm({
                      roleGroup: e.target.value as TeamRoleGroup,
                      roleColor: teamRoleColor(e.target.value as TeamRoleGroup, form.roleColor),
                    })
                  }
                >
                  {TEAM_ROLE_GROUPS.map((group) => (
                    <option key={group.key} value={group.key}>
                      {teamRoleTitle(group.key)}
                    </option>
                  ))}
                </select>
                <Input
                  placeholder="Role badge"
                  value={form.roleBadge}
                  onChange={(e) => patchForm({ roleBadge: e.target.value })}
                />
                <Input
                  type="color"
                  value={form.roleColor}
                  onChange={(e) => patchForm({ roleColor: e.target.value })}
                />
                <select
                  className="flex h-10 rounded-md border border-input bg-background/50 px-3 text-sm"
                  value={form.departmentId}
                  onChange={(e) => patchForm({ departmentId: e.target.value })}
                >
                  <option value="">No category</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
            </section>

            <section className="space-y-3">
              <h4 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                Media
              </h4>
              <TeamMemberMediaUpload
                avatarUrl={form.avatarUrl || null}
                bannerUrl={form.bannerUrl || null}
                teamMemberId={editingId !== "new" ? editingId ?? undefined : undefined}
                disabled={pending}
                onAvatarChange={(url) => patchForm({ avatarUrl: url })}
                onBannerChange={(url) => patchForm({ bannerUrl: url })}
              />
            </section>

            <section className="space-y-3">
              <h4 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                Contact
              </h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  type="email"
                  placeholder="Email"
                  value={form.email}
                  onChange={(e) => patchForm({ email: e.target.value })}
                />
                <Input
                  placeholder="Discord invite or profile URL"
                  value={form.discordUrl}
                  onChange={(e) => patchForm({ discordUrl: e.target.value })}
                />
                <Input
                  placeholder="Website"
                  value={form.websiteUrl}
                  onChange={(e) => patchForm({ websiteUrl: e.target.value })}
                  className="sm:col-span-2"
                />
              </div>
            </section>

            <section className="space-y-3">
              <h4 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                Social links
              </h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  placeholder="YouTube"
                  value={form.youtubeUrl}
                  onChange={(e) => patchForm({ youtubeUrl: e.target.value })}
                />
                <Input
                  placeholder="Twitch"
                  value={form.twitchUrl}
                  onChange={(e) => patchForm({ twitchUrl: e.target.value })}
                />
                <Input
                  placeholder="TikTok"
                  value={form.tiktokUrl}
                  onChange={(e) => patchForm({ tiktokUrl: e.target.value })}
                />
                <Input
                  placeholder="Instagram"
                  value={form.instagramUrl}
                  onChange={(e) => patchForm({ instagramUrl: e.target.value })}
                />
                <Input
                  placeholder="X / Twitter"
                  value={form.xUrl}
                  onChange={(e) => patchForm({ xUrl: e.target.value })}
                />
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                  Custom links
                </h4>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    patchForm({ customLinks: [...form.customLinks, { label: "", url: "" }] })
                  }
                >
                  <Link2 className="mr-1 h-4 w-4" /> Add link
                </Button>
              </div>
              {form.customLinks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No custom links yet.</p>
              ) : (
                <div className="space-y-2">
                  {form.customLinks.map((link, index) => (
                    <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                      <Input
                        placeholder="Label"
                        value={link.label}
                        onChange={(e) => {
                          const next = [...form.customLinks];
                          next[index] = { ...next[index]!, label: e.target.value };
                          patchForm({ customLinks: next });
                        }}
                      />
                      <Input
                        placeholder="URL"
                        value={link.url}
                        onChange={(e) => {
                          const next = [...form.customLinks];
                          next[index] = { ...next[index]!, url: e.target.value };
                          patchForm({ customLinks: next });
                        }}
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() =>
                          patchForm({
                            customLinks: form.customLinks.filter((_, i) => i !== index),
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-3">
              <h4 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                Biography
              </h4>
              <Textarea
                placeholder="Public biography shown on the team page"
                rows={4}
                value={form.description}
                onChange={(e) => patchForm({ description: e.target.value })}
              />
            </section>

            <section className="grid gap-3 sm:grid-cols-3">
              <select
                className="flex h-10 rounded-md border border-input bg-background/50 px-3 text-sm"
                value={form.visibility}
                onChange={(e) => patchForm({ visibility: e.target.value as TeamVisibility })}
              >
                <option value="PUBLIC">Public</option>
                <option value="INTERNAL">Internal only</option>
                <option value="HIDDEN">Hidden</option>
              </select>
              <Input
                type="number"
                placeholder="Sort order"
                value={form.sortOrder}
                onChange={(e) => patchForm({ sortOrder: Number(e.target.value) || 0 })}
              />
              <label className="flex items-center gap-2 rounded-md border border-border/40 px-3 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => patchForm({ isActive: e.target.checked })}
                />
                Active on team page
              </label>
            </section>

            <div className="flex flex-wrap gap-2">
              <Button variant="neon" disabled={pending} onClick={saveProfile}>
                {editingId === "new" ? "Create member" : "Save changes"}
              </Button>
              <Button type="button" variant="outline" disabled={pending} onClick={cancelEdit}>
                Cancel
              </Button>
            </div>
          </Card>
        )}

        <div className="space-y-2">
          {profiles.length === 0 ? (
            <Card className="glass p-8 text-center text-muted-foreground">
              No team members yet. Add your first profile to populate the public team page.
            </Card>
          ) : (
            profiles.map((profile, index) => (
              <div
                key={profile.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-border/40 p-3 glass"
              >
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-muted/40">
                  <SafeImage
                    src={profile.avatarUrl}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="48px"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{profile.name}</p>
                    {!profile.isActive && <Badge variant="destructive">Inactive</Badge>}
                    {profile.user && (
                      <Badge variant="outline">@{profile.user.username}</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {teamRoleTitle(profile.roleGroup)} · {profile.position}
                    {profile.department && ` · ${profile.department.name}`}
                  </p>
                </div>
                {profile.roleBadge && (
                  <Badge style={{ borderColor: teamRoleColor(profile.roleGroup, profile.roleColor) }}>
                    {profile.roleBadge}
                  </Badge>
                )}
                <Badge variant="outline">{profile.visibility}</Badge>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={pending || index === 0}
                    onClick={() => moveProfile(profile.id, -1)}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={pending || index === profiles.length - 1}
                    onClick={() => moveProfile(profile.id, 1)}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => startEdit(profile)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => removeProfile(profile.id, profile.name)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}
