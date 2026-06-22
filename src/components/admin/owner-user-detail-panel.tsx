"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UserRole, type MembershipTier } from "@prisma/client";
import {
  ownerAssignMembership,
  ownerEnterpriseBan,
  ownerLiftBan,
  ownerRestoreUser,
  ownerSetUserPermission,
  ownerSoftDeleteUser,
  ownerSuspendUser,
  ownerUpdateUserRole,
} from "@/actions/admin/owner-users";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAppToast } from "@/hooks/use-app-toast";
import { PERMISSIONS, type PermissionKey } from "@/lib/permissions";
import { ASSIGNABLE_ROLES } from "@/lib/permission-types";
import { formatDisplayName } from "@/lib/display-name";
import { formatRoleLabel, roleBadgeVariant } from "@/lib/role-display";
import { safeToLocaleDateString } from "@/lib/i18n/safe-locale";

type OwnerUserDetail = {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  role: UserRole;
  isBanned: boolean;
  isSuspended: boolean;
  uploadBanned: boolean;
  commentBanned: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  banReason: string | null;
  userMembership: {
    membershipType: MembershipTier;
    status: string;
    renewalDate: Date | null;
    cancelDate: Date | null;
    isLifetime: boolean;
    stripeSubscriptionId: string | null;
  } | null;
  userPermissions: { permissionKey: string; granted: boolean }[];
  roleHistory: {
    id: string;
    fromRole: UserRole | null;
    toRole: UserRole;
    reason: string | null;
    createdAt: Date;
    changedBy: { username: string } | null;
  }[];
  banRecords: {
    id: string;
    reason: string | null;
    banScope: string;
    banType: string;
    createdAt: Date;
    liftedAt: Date | null;
    bannedBy: { username: string } | null;
  }[];
  purchases: { id: string; amountCents: number; createdAt: Date; mod: { title: string } }[];
  shopPurchases: { id: string; priceCents: number; createdAt: Date; product: { name: string } }[];
  mods: { id: string; title: string; slug: string; status: string }[];
  supportTickets: { id: string; ticketNumber: string; subject: string; status: string }[];
  creatorApplications: { id: string; status: string; createdAt: Date }[];
  partnerApplications: { id: string; status: string; createdAt: Date }[];
  _count: { downloads: number; favorites: number; mods: number; supportTickets: number };
};

export function OwnerUserDetailPanel({
  locale,
  user,
  auditLogs,
}: {
  locale: string;
  user: OwnerUserDetail;
  auditLogs: {
    id: string;
    action: string;
    createdAt: Date;
    actor: { username: string; role: string } | null;
  }[];
}) {
  const router = useRouter();
  const appToast = useAppToast();
  const [pending, startTransition] = useTransition();
  const [banReason, setBanReason] = useState("");
  const [banScope, setBanScope] = useState<"ACCOUNT" | "UPLOAD" | "COMMENT" | "IP">("ACCOUNT");
  const [roleReason, setRoleReason] = useState("");

  function run(action: () => Promise<{ success: boolean; error?: string }>, msg = "Saved") {
    startTransition(async () => {
      const r = await action();
      if (!r.success) appToast.error(r.error);
      else {
        appToast.saved(msg);
        router.refresh();
      }
    });
  }

  const granted = new Set(user.userPermissions.filter((p) => p.granted).map((p) => p.permissionKey));
  const permissionKeys = Object.keys(PERMISSIONS) as PermissionKey[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{formatDisplayName(user)}</h1>
          <p className="text-muted-foreground">{user.email}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant={roleBadgeVariant(user.role)}>{formatRoleLabel(user.role)}</Badge>
            {user.isBanned && <Badge variant="destructive">Account banned</Badge>}
            {user.isSuspended && <Badge variant="outline">Suspended</Badge>}
            {user.deletedAt && <Badge variant="destructive">Deleted</Badge>}
          </div>
        </div>
        <Link href={`/${locale}/admin/owner/users`} className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to users
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="glass"><CardHeader><CardTitle className="text-sm">Downloads</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{user._count.downloads}</p></CardContent></Card>
        <Card className="glass"><CardHeader><CardTitle className="text-sm">Uploads</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{user._count.mods}</p></CardContent></Card>
        <Card className="glass"><CardHeader><CardTitle className="text-sm">Tickets</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{user._count.supportTickets}</p></CardContent></Card>
        <Card className="glass"><CardHeader><CardTitle className="text-sm">Member since</CardTitle></CardHeader><CardContent><p className="text-sm">{safeToLocaleDateString(user.createdAt)}</p></CardContent></Card>
      </div>

      <Card className="glass p-4 space-y-3">
        <h3 className="font-semibold">Role management</h3>
        <div className="flex flex-wrap gap-2 items-end">
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            defaultValue={user.role}
            onChange={(e) => {
              const role = e.target.value as UserRole;
              run(() => ownerUpdateUserRole(user.id, role, roleReason || undefined), "Role updated");
            }}
          >
            {ASSIGNABLE_ROLES.map((r) => (
              <option key={r} value={r}>{formatRoleLabel(r)}</option>
            ))}
          </select>
          <Input placeholder="Reason (optional)" value={roleReason} onChange={(e) => setRoleReason(e.target.value)} className="max-w-xs" />
          <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => ownerSuspendUser(user.id, !user.isSuspended), user.isSuspended ? "Unsuspended" : "Suspended")}>
            {user.isSuspended ? "Unsuspend" : "Suspend"}
          </Button>
          {user.deletedAt ? (
            <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => ownerRestoreUser(user.id), "Restored")}>Restore account</Button>
          ) : (
            <Button variant="destructive" size="sm" disabled={pending} onClick={() => run(() => ownerSoftDeleteUser(user.id), "Account disabled")}>Disable account</Button>
          )}
        </div>
      </Card>

      <Card className="glass p-4 space-y-3">
        <h3 className="font-semibold">Premium management</h3>
        {user.userMembership && (
          <p className="text-sm text-muted-foreground">
            {user.userMembership.membershipType} · {user.userMembership.status}
            {user.userMembership.renewalDate && ` · renews ${safeToLocaleDateString(user.userMembership.renewalDate)}`}
            {user.userMembership.stripeSubscriptionId && ` · Stripe`}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {(["FREE", "PREMIUM_LITE", "PREMIUM", "PREMIUM_MAX"] as MembershipTier[]).map((tier) => (
            <Button
              key={tier}
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => run(() => ownerAssignMembership(user.id, tier, { extendDays: 30 }), `${tier} assigned`)}
            >
              {tier.replace("_", " ")}
            </Button>
          ))}
          <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => ownerAssignMembership(user.id, "PREMIUM_MAX", { lifetime: true }), "Lifetime premium")}>
            Lifetime Premium Max
          </Button>
        </div>
      </Card>

      <Card className="glass p-4 space-y-3">
        <h3 className="font-semibold">Ban management</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <Input placeholder="Ban reason (required)" value={banReason} onChange={(e) => setBanReason(e.target.value)} />
          <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={banScope} onChange={(e) => setBanScope(e.target.value as typeof banScope)}>
            <option value="ACCOUNT">Ban account</option>
            <option value="UPLOAD">Ban uploads</option>
            <option value="COMMENT">Ban comments</option>
            <option value="IP">Ban IP (record)</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="destructive"
            size="sm"
            disabled={pending || banReason.length < 3}
            onClick={() =>
              run(
                () =>
                  ownerEnterpriseBan({
                    userId: user.id,
                    reason: banReason,
                    scope: banScope,
                    duration: "permanent",
                  }),
                "Ban applied"
              )
            }
          >
            Apply ban
          </Button>
          {user.isBanned && (
            <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => ownerLiftBan(user.id, "ACCOUNT"), "Unbanned")}>Lift account ban</Button>
          )}
          {user.uploadBanned && (
            <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => ownerLiftBan(user.id, "UPLOAD"), "Upload ban lifted")}>Lift upload ban</Button>
          )}
          {user.commentBanned && (
            <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => ownerLiftBan(user.id, "COMMENT"), "Comment ban lifted")}>Lift comment ban</Button>
          )}
        </div>
        {user.banRecords.length > 0 && (
          <ul className="text-xs space-y-1 text-muted-foreground">
            {user.banRecords.slice(0, 8).map((b) => (
              <li key={b.id}>
                {b.banScope} · {b.banType} · {b.reason} · {safeToLocaleDateString(b.createdAt)}
                {b.liftedAt ? " (lifted)" : ""}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="glass p-4 space-y-3">
        <h3 className="font-semibold">Individual permissions</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 max-h-72 overflow-y-auto">
          {permissionKeys.map((key) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={granted.has(key)}
                onChange={(e) =>
                  run(() => ownerSetUserPermission(user.id, key, e.target.checked), "Permission updated")
                }
              />
              <span className="truncate" title={PERMISSIONS[key]}>{key}</span>
            </label>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="glass p-4">
          <h3 className="font-semibold mb-3">Purchases & uploads</h3>
          <ul className="text-sm space-y-1 text-muted-foreground">
            {user.purchases.slice(0, 5).map((p) => (
              <li key={p.id}>{p.mod.title} · €{(p.amountCents / 100).toFixed(2)}</li>
            ))}
            {user.shopPurchases.slice(0, 5).map((p) => (
              <li key={p.id}>{p.product.name} · €{(p.priceCents / 100).toFixed(2)}</li>
            ))}
            {user.mods.slice(0, 5).map((m) => (
              <li key={m.id}>
                <Link href={`/${locale}/mods/${m.slug}`} className="text-neon-purple hover:underline">{m.title}</Link> · {m.status}
              </li>
            ))}
          </ul>
        </Card>
        <Card className="glass p-4">
          <h3 className="font-semibold mb-3">Tickets & applications</h3>
          <ul className="text-sm space-y-1 text-muted-foreground">
            {user.supportTickets.map((t) => (
              <li key={t.id}>{t.ticketNumber}: {t.subject} ({t.status})</li>
            ))}
            {user.creatorApplications.map((a) => (
              <li key={a.id}>Creator app · {a.status}</li>
            ))}
            {user.partnerApplications.map((a) => (
              <li key={a.id}>Partner app · {a.status}</li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="glass p-4">
        <h3 className="font-semibold mb-3">Role history</h3>
        <ul className="text-sm space-y-1">
          {user.roleHistory.map((h) => (
            <li key={h.id} className="text-muted-foreground">
              {h.fromRole ?? "?"} → {h.toRole} by @{h.changedBy?.username ?? "system"} · {safeToLocaleDateString(h.createdAt)}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="glass p-4">
        <h3 className="font-semibold mb-3">Owner audit log</h3>
        <ul className="text-sm space-y-1 max-h-64 overflow-y-auto">
          {auditLogs.map((log) => (
            <li key={log.id} className="text-muted-foreground">
              <span className="text-foreground">{log.action}</span> · @{log.actor?.username ?? "system"} · {safeToLocaleDateString(log.createdAt)}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
