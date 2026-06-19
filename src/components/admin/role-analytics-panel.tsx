"use client";

import { Card } from "@/components/ui/card";
import { safeToLocaleString, safeToLocaleDateString, getIntlLocale } from "@/lib/i18n/safe-locale";
import { Badge } from "@/components/ui/badge";
import { formatRoleLabel } from "@/lib/role-display";

type Props = {
  data: {
    usersByRole: { role: string; count: number }[];
    activePurchases: number;
    customGroups: {
      id: string;
      name: string;
      slug: string;
      userCount: number;
      isDisabled: boolean;
      isSystem: boolean;
    }[];
    purchasesByPlan: { planId: string; planName: string; count: number }[];
    totalPermissions: number;
    rolePermissions: { role: string; permissionCount: number }[];
  };
};

export function RoleAnalyticsPanel({ data }: Props) {
  const totalUsers = data.usersByRole.reduce((s, r) => s + r.count, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Role analytics</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Users per role, active memberships, and permission coverage.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="glass p-4">
          <p className="text-xs text-muted-foreground">Total users</p>
          <p className="text-2xl font-bold">{safeToLocaleString(totalUsers)}</p>
        </Card>
        <Card className="glass p-4">
          <p className="text-xs text-muted-foreground">Active memberships</p>
          <p className="text-2xl font-bold">{safeToLocaleString(data.activePurchases)}</p>
        </Card>
        <Card className="glass p-4">
          <p className="text-xs text-muted-foreground">Custom roles</p>
          <p className="text-2xl font-bold">{data.customGroups.length}</p>
        </Card>
        <Card className="glass p-4">
          <p className="text-xs text-muted-foreground">Permission keys</p>
          <p className="text-2xl font-bold">{data.totalPermissions}</p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="glass p-5 space-y-3">
          <h3 className="font-medium">Users by built-in role</h3>
          <div className="space-y-2">
            {data.usersByRole
              .sort((a, b) => b.count - a.count)
              .map((row) => (
                <div key={row.role} className="flex items-center justify-between text-sm">
                  <span>{formatRoleLabel(row.role)}</span>
                  <Badge variant="outline">{row.count}</Badge>
                </div>
              ))}
          </div>
        </Card>

        <Card className="glass p-5 space-y-3">
          <h3 className="font-medium">Membership purchases by plan</h3>
          <div className="space-y-2">
            {data.purchasesByPlan.length === 0 ? (
              <p className="text-sm text-muted-foreground">No purchases yet</p>
            ) : (
              data.purchasesByPlan.map((row) => (
                <div key={row.planId} className="flex items-center justify-between text-sm">
                  <span>{row.planName}</span>
                  <Badge variant="premium">{row.count}</Badge>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="glass p-5 space-y-3">
          <h3 className="font-medium">Custom role assignments</h3>
          <div className="space-y-2">
            {data.customGroups.map((g) => (
              <div key={g.id} className="flex items-center justify-between text-sm gap-2">
                <span className="truncate">
                  {g.name}
                  {g.isSystem && <Badge className="ml-2" variant="outline">System</Badge>}
                  {g.isDisabled && <Badge className="ml-2" variant="destructive">Off</Badge>}
                </span>
                <Badge variant="outline">{g.userCount} users</Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card className="glass p-5 space-y-3">
          <h3 className="font-medium">Effective permissions per role</h3>
          <div className="space-y-2">
            {data.rolePermissions.map((row) => (
              <div key={row.role} className="flex items-center justify-between text-sm">
                <span>{formatRoleLabel(row.role)}</span>
                <Badge variant="outline">{row.permissionCount} keys</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
