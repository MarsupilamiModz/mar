"use client";

import { memo, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserRole } from "@prisma/client";
import { updateAdminRolePermissions } from "@/actions/admin/permissions";
import { PERMISSIONS, ROLE_HIERARCHY, type PermissionKey } from "@/lib/permissions";
import { ASSIGNABLE_ROLES } from "@/lib/permission-types";
import { PERMISSION_UI_GROUPS, filterPermissionsBySearch } from "@/lib/permission-ui";
import { CustomRolesEditor, type CustomRole } from "@/components/admin/custom-roles-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useAppToast } from "@/hooks/use-app-toast";
import { formatRoleLabel, ROLE_HIERARCHY_LABEL } from "@/lib/role-display";

type RoleRow = {
  role: UserRole;
  permissions: PermissionKey[];
};

function GroupsAdminPanelInner({
  groups,
  roles,
}: {
  groups: CustomRole[];
  roles: RoleRow[];
}) {
  const appToast = useAppToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<"builtin" | "custom">("custom");
  const [activeRole, setActiveRole] = useState<UserRole>("MODERATOR");
  const [rolePerms, setRolePerms] = useState<string[]>(
    roles.find((r) => r.role === "MODERATOR")?.permissions.map(String) ?? []
  );
  const [permSearch, setPermSearch] = useState("");

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

  const visibleBuiltinPerms = useMemo(() => {
    const all = Object.keys(PERMISSIONS) as PermissionKey[];
    return filterPermissionsBySearch(permSearch, all);
  }, [permSearch]);

  const togglePerm = (key: string) => {
    setRolePerms((prev) => (prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button variant={tab === "custom" ? "neon" : "outline"} size="sm" onClick={() => setTab("custom")}>
          Custom roles
        </Button>
        <Button variant={tab === "builtin" ? "neon" : "outline"} size="sm" onClick={() => setTab("builtin")}>
          Built-in role permissions
        </Button>
      </div>

      {tab === "custom" ? (
        <CustomRolesEditor groups={groups} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="glass p-4 space-y-2 h-fit">
            <h3 className="font-semibold text-sm">Built-in roles</h3>
            <p className="text-xs text-muted-foreground mb-2">Hierarchy: {ROLE_HIERARCHY_LABEL}</p>
            {ASSIGNABLE_ROLES.map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => selectRole(role)}
                className={`w-full text-left rounded-md px-3 py-2 text-sm transition-colors ${
                  activeRole === role ? "bg-neon-purple/15 text-neon-purple font-medium" : "hover:bg-accent/20"
                }`}
              >
                {formatRoleLabel(role)}
              </button>
            ))}
          </Card>

          <Card className="glass p-5 space-y-4 lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-semibold">{formatRoleLabel(activeRole)} permissions</h3>
              <Badge variant="outline">{inheritedPreview().length} effective with inheritance</Badge>
            </div>
            <Input
              placeholder="Search permissions…"
              value={permSearch}
              onChange={(e) => setPermSearch(e.target.value)}
            />
            <div className="max-h-80 overflow-y-auto space-y-4">
              {PERMISSION_UI_GROUPS.map((group) => {
                const keys = filterPermissionsBySearch(permSearch, group.keys);
                if (keys.length === 0) return null;
                return (
                  <div key={group.id}>
                    <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">{group.label}</p>
                    <div className="space-y-2">
                      {keys.map((key) => (
                        <label key={key} className="flex items-center justify-between gap-3 rounded-md border border-border/30 px-3 py-2 text-sm">
                          <span>
                            <span className="font-mono text-xs">{key}</span>
                            <span className="block text-xs text-muted-foreground">{PERMISSIONS[key]}</span>
                          </span>
                          <Switch checked={rolePerms.includes(key)} onCheckedChange={() => togglePerm(key)} />
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
              {visibleBuiltinPerms
                .filter((k) => !PERMISSION_UI_GROUPS.some((g) => g.keys.includes(k)))
                .map((key) => (
                  <label key={key} className="flex items-center justify-between gap-3 rounded-md border border-border/30 px-3 py-2 text-sm">
                    <span className="font-mono text-xs">{key}</span>
                    <Switch checked={rolePerms.includes(key)} onCheckedChange={() => togglePerm(key)} />
                  </label>
                ))}
            </div>
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
              Save built-in role permissions
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}

export const GroupsAdminPanel = memo(GroupsAdminPanelInner);
