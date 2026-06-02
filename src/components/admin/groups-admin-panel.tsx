"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserRole } from "@prisma/client";
import { savePermissionGroup } from "@/actions/admin/branding";
import { deletePermissionGroup, updateAdminRolePermissions } from "@/actions/admin/permissions";
import { PERMISSIONS, ROLE_HIERARCHY, type PermissionKey } from "@/lib/permissions";
import { ASSIGNABLE_ROLES } from "@/lib/permission-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAppToast } from "@/hooks/use-app-toast";
import { ROLE_LABELS } from "@/lib/ticket-labels";

type Group = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  permissions: unknown;
  isSystem: boolean;
};

type RoleRow = {
  role: UserRole;
  permissions: PermissionKey[];
};

export function GroupsAdminPanel({
  groups,
  roles,
}: {
  groups: Group[];
  roles: RoleRow[];
}) {
  const appToast = useAppToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<"roles" | "groups">("roles");
  const [editing, setEditing] = useState<Group | null>(null);
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [activeRole, setActiveRole] = useState<UserRole>("MODERATOR");
  const [rolePerms, setRolePerms] = useState<string[]>(
    roles.find((r) => r.role === "MODERATOR")?.permissions.map(String) ?? []
  );

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
    setTab("groups");
  };

  const togglePerm = (key: string, list: string[], setList: (v: string[]) => void) => {
    setList(list.includes(key) ? list.filter((p) => p !== key) : [...list, key]);
  };

  const selectRole = (role: UserRole) => {
    setActiveRole(role);
    const row = roles.find((r) => r.role === role);
    setRolePerms(row?.permissions.map(String) ?? []);
  };

  const inheritedPreview = () => {
    const idx = ROLE_HIERARCHY.indexOf(activeRole);
    const inherited = new Set<string>();
    for (let i = 0; i <= idx; i++) {
      const row = roles.find((r) => r.role === ROLE_HIERARCHY[i]);
      row?.permissions.forEach((p) => inherited.add(p));
    }
    rolePerms.forEach((p) => inherited.add(p));
    return Array.from(inherited);
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <Button variant={tab === "roles" ? "neon" : "outline"} size="sm" onClick={() => setTab("roles")}>
          Role permissions
        </Button>
        <Button variant={tab === "groups" ? "neon" : "outline"} size="sm" onClick={() => setTab("groups")}>
          Permission groups
        </Button>
      </div>

      {tab === "roles" ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="glass p-4 space-y-2 h-fit">
            <h3 className="font-semibold text-sm">Roles</h3>
            {ASSIGNABLE_ROLES.map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => selectRole(role)}
                className={`w-full text-left rounded-md px-3 py-2 text-sm transition-colors ${
                  activeRole === role ? "bg-neon-purple/15 text-neon-purple" : "hover:bg-accent/20"
                }`}
              >
                {ROLE_LABELS[role] ?? role}
              </button>
            ))}
          </Card>

          <Card className="glass p-5 space-y-4 lg:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold">{ROLE_LABELS[activeRole] ?? activeRole} permissions</h3>
              <Badge variant="outline">{inheritedPreview().length} effective (with inheritance)</Badge>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1 text-sm grid sm:grid-cols-2 gap-x-4">
              {(Object.keys(PERMISSIONS) as PermissionKey[]).map((key) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rolePerms.includes(key)}
                    onChange={() => togglePerm(key, rolePerms, setRolePerms)}
                  />
                  <span>{key}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Higher roles inherit permissions from lower tiers: {ROLE_HIERARCHY.join(" → ")}
            </p>
            <Button
              variant="neon"
              disabled={pending || activeRole === "OWNER"}
              onClick={() =>
                startTransition(async () => {
                  const r = await updateAdminRolePermissions(activeRole, rolePerms);
                  if (r.success) {
                    appToast.saved();
                    router.refresh();
                  } else appToast.error(r.error);
                })
              }
            >
              Save role permissions
            </Button>
          </Card>
        </div>
      ) : (
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
                {!g.isSystem && (
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={pending}
                    onClick={(e) => {
                      e.stopPropagation();
                      startTransition(async () => {
                        const r = await deletePermissionGroup(g.id);
                        if (r.success) {
                          appToast.saved();
                          router.refresh();
                        } else appToast.error(r.error);
                      });
                    }}
                  >
                    Delete
                  </Button>
                )}
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
                  <input type="checkbox" checked={selected.includes(key)} onChange={() => togglePerm(key, selected, setSelected)} />
                  <span>{key}</span>
                </label>
              ))}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={selected.includes("*")} onChange={() => togglePerm("*", selected, setSelected)} />
                <span>* (full access)</span>
              </label>
            </div>
            <Button
              variant="neon"
              disabled={pending || !!editing?.isSystem}
              onClick={() => {
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
                    router.refresh();
                  } else appToast.error(r.error);
                });
              }}
            >
              {editing ? "Update group" : "Create group"}
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}
