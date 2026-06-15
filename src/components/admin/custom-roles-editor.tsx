"use client";

import { memo, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Plus,
  Search,
  Shield,
  Trash2,
} from "lucide-react";
import {
  duplicatePermissionGroup,
  reorderPermissionGroups,
  savePermissionGroup,
} from "@/actions/admin/branding";
import { deletePermissionGroup } from "@/actions/admin/permissions";
import { PERMISSIONS } from "@/lib/permissions";
import {
  PERMISSION_UI_GROUPS,
  UNGROUPED_PERMISSIONS,
  filterPermissionsBySearch,
} from "@/lib/permission-ui";
import { SLUG_AUTO_GENERATED_MESSAGE } from "@/lib/slug";
import { useSlugField } from "@/hooks/use-slug-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useAppToast } from "@/hooks/use-app-toast";
import { formatGroupLabel } from "@/lib/role-display";

const HIERARCHY_TIERS = [
  "Owner",
  "Admin",
  "Moderator",
  "Support",
  "Custom",
  "Creator",
  "Partner",
  "Premium",
  "User",
];

const DASHBOARD_OPTIONS = ["admin", "creator", "partner", "dashboard", "premium"];

export type CustomRole = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  permissions: unknown;
  isSystem: boolean;
  color?: string | null;
  badge?: string | null;
  icon?: string | null;
  hierarchyTier?: string | null;
  dashboardAccess?: unknown;
  sortOrder?: number;
  isDisabled?: boolean;
};

function PermissionPicker({
  selected,
  onChange,
  search,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
  search: string;
}) {
  const toggle = (key: string) => {
    onChange(selected.includes(key) ? selected.filter((p) => p !== key) : [...selected, key]);
  };

  const groups = useMemo(
    () =>
      PERMISSION_UI_GROUPS.map((g) => ({
        ...g,
        keys: filterPermissionsBySearch(search, g.keys),
      })).filter((g) => g.keys.length > 0),
    [search]
  );

  const ungrouped = filterPermissionsBySearch(search, UNGROUPED_PERMISSIONS);

  return (
    <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
      {groups.map((group) => (
        <div key={group.id} className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</p>
          <div className="space-y-2">
            {group.keys.map((key) => (
              <label key={key} className="flex items-center justify-between gap-3 rounded-md border border-border/30 px-3 py-2 text-sm">
                <span>
                  <span className="font-mono text-xs">{key}</span>
                  <span className="block text-xs text-muted-foreground">{PERMISSIONS[key]}</span>
                </span>
                <Switch checked={selected.includes(key)} onCheckedChange={() => toggle(key)} />
              </label>
            ))}
          </div>
        </div>
      ))}
      {ungrouped.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Other</p>
          {ungrouped.map((key) => (
            <label key={key} className="flex items-center justify-between gap-3 rounded-md border border-border/30 px-3 py-2 text-sm">
              <span className="font-mono text-xs">{key}</span>
              <Switch checked={selected.includes(key)} onCheckedChange={() => toggle(key)} />
            </label>
          ))}
        </div>
      )}
      <label className="flex items-center justify-between gap-3 rounded-md border border-neon-purple/30 bg-neon-purple/5 px-3 py-2 text-sm">
        <span className="font-mono text-xs">* (full access)</span>
        <Switch checked={selected.includes("*")} onCheckedChange={() => toggle("*")} />
      </label>
    </div>
  );
}

function CustomRolesEditorInner({ groups: initial }: { groups: CustomRole[] }) {
  const appToast = useAppToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [roles, setRoles] = useState(initial);
  const [editing, setEditing] = useState<CustomRole | null>(null);
  const [name, setName] = useState("");
  const { slug, setSlug } = useSlugField(name);
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#a855f7");
  const [badge, setBadge] = useState("");
  const [icon, setIcon] = useState("");
  const [hierarchyTier, setHierarchyTier] = useState("");
  const [dashboardAccess, setDashboardAccess] = useState<string[]>([]);
  const [isDisabled, setIsDisabled] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [permSearch, setPermSearch] = useState("");

  const startCreate = () => {
    setEditing(null);
    setName("");
    setDescription("");
    setColor("#a855f7");
    setBadge("");
    setIcon("🛡️");
    setHierarchyTier("Custom");
    setDashboardAccess([]);
    setIsDisabled(false);
    setSelected([]);
    setPermSearch("");
  };

  const startEdit = (role: CustomRole) => {
    if (role.isSystem) return;
    setEditing(role);
    setName(role.name);
    setSlug(role.slug);
    setDescription(role.description ?? "");
    setColor(role.color ?? "#a855f7");
    setBadge(role.badge ?? "");
    setIcon(role.icon ?? "");
    setHierarchyTier(role.hierarchyTier ?? "");
    setDashboardAccess(Array.isArray(role.dashboardAccess) ? role.dashboardAccess.map(String) : []);
    setIsDisabled(role.isDisabled ?? false);
    setSelected(Array.isArray(role.permissions) ? role.permissions.map(String) : []);
  };

  const saveRole = () => {
    if (!name.trim()) {
      appToast.error("Role name is required");
      return;
    }
    startTransition(async () => {
      const r = await savePermissionGroup({
        id: editing?.id,
        slug: slug.trim() || undefined,
        name: name.trim(),
        description: description.trim() || undefined,
        permissions: selected,
        color: color || undefined,
        badge: badge.trim() || undefined,
        icon: icon.trim() || undefined,
        hierarchyTier: hierarchyTier || undefined,
        dashboardAccess,
        sortOrder: editing?.sortOrder ?? roles.length,
        isDisabled,
      });
      if (r.success) {
        const autoSlug =
          r.data &&
          typeof r.data === "object" &&
          "slugAutoGenerated" in r.data &&
          r.data.slugAutoGenerated;
        if (autoSlug) appToast.saved(SLUG_AUTO_GENERATED_MESSAGE);
        else appToast.saved();
        startCreate();
        router.refresh();
      } else appToast.error(r.error);
    });
  };

  const moveRole = (index: number, dir: -1 | 1) => {
    const next = [...roles];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setRoles(next);
    startTransition(async () => {
      const r = await reorderPermissionGroups(next.map((g) => g.id));
      if (r.success) router.refresh();
      else appToast.error(r.error);
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5 text-neon-purple" />
            Custom roles
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Create VIP, Developer, Translator, or any custom role. Permission changes sync live to assigned users.
          </p>
        </div>
        <Button variant="neon" size="sm" onClick={startCreate}>
          <Plus className="h-4 w-4 mr-1" /> Create role
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <div className="xl:col-span-2 space-y-3">
          {roles.map((role, index) => (
            <Card
              key={role.id}
              className={`glass p-4 space-y-2 cursor-pointer transition-colors hover:border-neon-purple/30 ${
                editing?.id === role.id ? "border-neon-purple/50" : ""
              } ${role.isDisabled ? "opacity-60" : ""}`}
              onClick={() => startEdit(role)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-lg">{role.icon ?? "🛡️"}</span>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{formatGroupLabel(role.name, role.slug)}</p>
                    <p className="text-xs font-mono text-muted-foreground truncate">{role.slug}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {role.isSystem && <Badge variant="outline">System</Badge>}
                  {role.isDisabled && <Badge variant="destructive">Disabled</Badge>}
                  {role.badge && <Badge style={{ backgroundColor: role.color ?? undefined }}>{role.badge}</Badge>}
                </div>
              </div>
              {!role.isSystem && (
                <div className="flex flex-wrap gap-1 pt-1" onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" variant="ghost" disabled={index === 0 || pending} onClick={() => moveRole(index, -1)}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" disabled={index === roles.length - 1 || pending} onClick={() => moveRole(index, 1)}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const r = await duplicatePermissionGroup(role.id);
                        if (r.success) {
                          appToast.saved();
                          router.refresh();
                        } else appToast.error(r.error);
                      })
                    }
                  >
                    <Copy className="h-3 w-3 mr-1" /> Duplicate
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const r = await deletePermissionGroup(role.id);
                        if (r.success) {
                          appToast.saved();
                          router.refresh();
                        } else appToast.error(r.error);
                      })
                    }
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>

        <Card className="glass p-5 space-y-4 xl:col-span-3 sticky top-24 h-fit">
          <h3 className="font-semibold">{editing ? `Edit ${editing.name}` : "New custom role"}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input placeholder="Role name" value={name} onChange={(e) => setName(e.target.value)} />
            <Input
              placeholder="Slug (auto)"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              disabled={!!editing}
              className="font-mono text-sm"
            />
          </div>
          <Input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <div className="grid gap-3 sm:grid-cols-3">
            <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10" />
            <Input placeholder="Badge" value={badge} onChange={(e) => setBadge(e.target.value)} />
            <Input placeholder="Icon" value={icon} onChange={(e) => setIcon(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-muted-foreground">Hierarchy tier</label>
              <select
                value={hierarchyTier}
                onChange={(e) => setHierarchyTier(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background/50 px-3 text-sm"
              >
                <option value="">—</option>
                {HIERARCHY_TIERS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Dashboard access</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {DASHBOARD_OPTIONS.map((opt) => (
                  <label key={opt} className="flex items-center gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      checked={dashboardAccess.includes(opt)}
                      onChange={(e) =>
                        setDashboardAccess((prev) =>
                          e.target.checked ? [...prev, opt] : prev.filter((x) => x !== opt)
                        )
                      }
                    />
                    {opt}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={isDisabled} onCheckedChange={setIsDisabled} />
            Role disabled
          </label>
          <Input
            placeholder="Search permissions…"
            value={permSearch}
            onChange={(e) => setPermSearch(e.target.value)}
          />
          <PermissionPicker selected={selected} onChange={setSelected} search={permSearch} />
          <Button variant="neon" disabled={pending || !!editing?.isSystem} onClick={saveRole}>
            {editing ? "Save role" : "Create role"}
          </Button>
        </Card>
      </div>
    </div>
  );
}

export const CustomRolesEditor = memo(CustomRolesEditorInner);
