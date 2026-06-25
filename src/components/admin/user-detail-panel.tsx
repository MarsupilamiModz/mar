"use client";

import { useState, useTransition } from "react";
import { safeToLocaleDateString } from "@/lib/i18n/safe-locale";
import { UserRole } from "@prisma/client";
import {
  banUser,
  restoreUser,
  setUserPremium,
  softDeleteUser,
  unbanUser,
  updateUserRole,
  assignUserPermissionGroup,
  adminResendVerification,
  adminUpdateUserEmail,
} from "@/actions/admin/users";
import { MembershipManager } from "@/components/admin/membership-manager";
import type { MembershipTier } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { toast } from "@/hooks/use-toast";
import { formatRoleLabel, roleBadgeVariant } from "@/lib/role-display";
import { TICKET_STATUS_LABELS } from "@/lib/ticket-labels";
import { formatDisplayName } from "@/lib/display-name";
import { ASSIGNABLE_ROLES } from "@/lib/permission-types";
import { Input } from "@/components/ui/input";
import { isPlaceholderEmail } from "@/lib/email/address";
import Link from "next/link";
import { useRouter } from "next/navigation";

type UserDetail = {
  id: string;
  username: string;
  email: string;
  emailVerified: boolean;
  emailVerifiedAt: Date | null;
  displayName: string | null;
  role: UserRole;
  permissionGroupId: string | null;
  isBanned: boolean;
  banReason: string | null;
  bannedAt: Date | null;
  discordId: string | null;
  discordUsername: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  subscriptions: { id: string; status: string; interval: string; currentPeriodEnd: Date }[];
  membershipPurchases: {
    id: string;
    amountCents: number;
    createdAt: Date;
    plan: { name: string; slug: string; priceCents: number };
  }[];
  banRecords: { reason: string | null; createdAt: Date; bannedBy: { username: string } | null }[];
  supportTickets: { id: string; ticketNumber: string; subject: string; status: string }[];
  _count: { downloads: number; favorites: number; mods: number };
};

import { UserAchievementsPanel } from "@/components/admin/user-achievements-panel";
import type { getAdminAchievements, getUserAchievementsAdmin } from "@/actions/admin/achievements";

type UserAchievementAdmin = Extract<
  Awaited<ReturnType<typeof getUserAchievementsAdmin>>,
  { success: true }
>["data"][number];

type AchievementOption = Extract<
  Awaited<ReturnType<typeof getAdminAchievements>>,
  { success: true }
>["data"][number];

export function UserDetailPanel({
  locale,
  user,
  auditLogs,
  membershipPlans = [],
  permissionGroups = [],
  membershipState = null,
  billingHistory = [],
  emailLogs = [],
  userAchievements = [],
  allAchievements = [],
}: {
  locale: string;
  user: UserDetail;
  auditLogs: {
    id: string;
    action: string;
    createdAt: Date;
    actor: { username: string } | null;
  }[];
  membershipPlans?: { id: string; name: string; slug: string; priceCents?: number }[];
  permissionGroups?: { id: string; name: string; slug: string }[];
  membershipState?: {
    membershipType: MembershipTier;
    status: string;
    planSlug: string | null;
    renewalDate: Date | null;
    cancelDate: Date | null;
    isLifetime: boolean;
    stripeSubscriptionId: string | null;
  } | null;
  billingHistory?: {
    id: string;
    amountCents: number;
    createdAt: Date;
    stripePaymentId: string | null;
    plan: { name: string };
  }[];
  emailLogs?: {
    id: string;
    to: string;
    subject: string;
    templateKey: string | null;
    status: string;
    error: string | null;
    sentAt: Date | null;
    createdAt: Date;
  }[];
  userAchievements?: UserAchievementAdmin[];
  allAchievements?: AchievementOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmBan, setConfirmBan] = useState(false);
  const [adminEmail, setAdminEmail] = useState(user.email);

  async function run(action: () => Promise<{ success: boolean; error?: string }>, msg: string) {
    startTransition(async () => {
      const r = await action();
      if (r.success) {
        toast({ title: msg });
        router.refresh();
      } else toast({ title: "Error", description: r.error, variant: "destructive" });
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{formatDisplayName(user)}</h1>
          <p className="text-muted-foreground">{user.email}</p>
          <div className="mt-2 flex gap-2">
            <Badge variant={roleBadgeVariant(user.role)}>{formatRoleLabel(user.role)}</Badge>
            {!isPlaceholderEmail(user.email) && (
              <Badge variant={user.emailVerified ? "premium" : "destructive"}>
                {user.emailVerified ? "Email verified" : "Email unverified"}
              </Badge>
            )}
            {user.isBanned && <Badge variant="destructive">Banned</Badge>}
            {user.deletedAt && <Badge variant="destructive">Deleted</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {user.deletedAt ? (
            <Button variant="outline" disabled={pending} onClick={() => run(() => restoreUser(user.id), "Restored")}>
              Restore
            </Button>
          ) : (
            <>
              {user.isBanned ? (
                <Button variant="outline" disabled={pending} onClick={() => run(() => unbanUser(user.id), "Unbanned")}>
                  Unban
                </Button>
              ) : (
                <Button variant="destructive" disabled={pending} onClick={() => setConfirmBan(true)}>
                  Ban
                </Button>
              )}
              <Button variant="outline" disabled={pending} onClick={() => run(() => setUserPremium(user.id, user.role !== "PREMIUM"), "Updated")}>
                Toggle Premium
              </Button>
              <Button variant="outline" disabled={pending} onClick={() => run(() => softDeleteUser(user.id), "Soft deleted")}>
                Soft Delete
              </Button>
            </>
          )}
        </div>
      </div>

      <Card className="glass p-5 space-y-4">
        <h3 className="font-semibold">Access control</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs text-muted-foreground">Role</label>
            <select
              className="mt-1 h-10 w-full rounded-md border border-input bg-background/50 px-3 text-sm"
              value={user.role}
              disabled={pending}
              onChange={(e) =>
                run(
                  () => updateUserRole(user.id, e.target.value as UserRole),
                  "Role updated"
                )
              }
            >
              {ASSIGNABLE_ROLES.map((role) => (
                <option key={role} value={role}>{formatRoleLabel(role)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Permission group (optional extras)</label>
            <select
              className="mt-1 h-10 w-full rounded-md border border-input bg-background/50 px-3 text-sm"
              value={user.permissionGroupId ?? ""}
              disabled={pending}
              onChange={(e) =>
                run(
                  () => assignUserPermissionGroup(user.id, e.target.value || null),
                  "Permission group updated"
                )
              }
            >
              <option value="">None</option>
              {(permissionGroups ?? []).map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="glass"><CardHeader><CardTitle className="text-sm">Downloads</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{user._count.downloads}</p></CardContent></Card>
        <Card className="glass"><CardHeader><CardTitle className="text-sm">Favorites</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{user._count.favorites}</p></CardContent></Card>
        <Card className="glass"><CardHeader><CardTitle className="text-sm">Mods</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{user._count.mods}</p></CardContent></Card>
        <Card className="glass"><CardHeader><CardTitle className="text-sm">Member since</CardTitle></CardHeader><CardContent><p className="text-sm">{safeToLocaleDateString(new Date(user.createdAt))}</p></CardContent></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="glass">
          <CardHeader><CardTitle>Discord</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {user.discordId ? (
              <>
                <p>ID: {user.discordId}</p>
                {user.discordUsername && <p>@{user.discordUsername}</p>}
              </>
            ) : (
              <p>Not connected</p>
            )}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader><CardTitle>Membership (legacy purchases)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {user.membershipPurchases.length === 0 ? (
              <p className="text-sm text-muted-foreground">No legacy purchases</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {user.membershipPurchases.map((p) => (
                  <li key={p.id} className="flex justify-between">
                    <span>{p.plan.name}</span>
                    <span className="text-muted-foreground">{safeToLocaleDateString(new Date(p.createdAt))}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {membershipState && (
          <MembershipManager
            userId={user.id}
            locale={locale}
            state={membershipState}
            plans={membershipPlans.map((p) => ({ ...p, priceCents: p.priceCents ?? 0 }))}
            billingHistory={billingHistory}
          />
        )}

        <Card className="glass">
          <CardHeader><CardTitle>Legacy subscriptions</CardTitle></CardHeader>
          <CardContent>
            {user.subscriptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">None (platform uses lifetime purchases)</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {user.subscriptions.map((s) => (
                  <li key={s.id}>
                    {s.status} · {s.interval} · ends {safeToLocaleDateString(new Date(s.currentPeriodEnd))}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="glass lg:col-span-2">
          <CardHeader><CardTitle>Recent Tickets</CardTitle></CardHeader>
          <CardContent>
            {user.supportTickets.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tickets</p>
            ) : (
              <ul className="space-y-2">
                {user.supportTickets.map((t) => (
                  <li key={t.id}>
                    <Link href={`/${locale}/admin/tickets/${t.id}`} className="text-sm hover:text-neon-purple">
                      {t.ticketNumber} — {t.subject} ({TICKET_STATUS_LABELS[t.status as keyof typeof TICKET_STATUS_LABELS]})
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader><CardTitle>Email</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {user.emailVerifiedAt && (
              <p className="text-xs text-muted-foreground">
                Verified {safeToLocaleDateString(new Date(user.emailVerifiedAt))}
              </p>
            )}
            {!isPlaceholderEmail(user.email) && !user.emailVerified && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() =>
                  run(() => adminResendVerification(user.id, locale), "Verification email sent")
                }
              >
                Resend verification
              </Button>
            )}
            <div className="space-y-2 pt-2 border-t border-border/40">
              <label className="text-xs text-muted-foreground">Admin email override</label>
              <Input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                disabled={pending}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending || !adminEmail.trim()}
                  onClick={() =>
                    run(
                      () => adminUpdateUserEmail(user.id, adminEmail, false),
                      "Email updated (unverified)"
                    )
                  }
                >
                  Set email
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending || !adminEmail.trim()}
                  onClick={() =>
                    run(
                      () => adminUpdateUserEmail(user.id, adminEmail, true),
                      "Email updated & verified"
                    )
                  }
                >
                  Set & verify
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass lg:col-span-2">
          <CardHeader><CardTitle>Email log</CardTitle></CardHeader>
          <CardContent>
            {!emailLogs?.length ? (
              <p className="text-sm text-muted-foreground">No emails logged for this user</p>
            ) : (
              <ul className="space-y-2 text-sm max-h-48 overflow-y-auto">
                {emailLogs.map((log) => (
                  <li key={log.id} className="flex justify-between gap-4 border-b border-border/30 pb-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{log.subject}</p>
                      <p className="text-xs text-muted-foreground">
                        {log.templateKey ?? "custom"} · {log.status}
                        {log.error ? ` · ${log.error}` : ""}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {safeToLocaleDateString(new Date(log.sentAt ?? log.createdAt))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {allAchievements.length > 0 && (
          <UserAchievementsPanel
            userId={user.id}
            initialAchievements={userAchievements}
            allAchievements={allAchievements}
          />
        )}

        <Card className="glass lg:col-span-2">
          <CardHeader><CardTitle>Audit Log</CardTitle></CardHeader>
          <CardContent>
            {auditLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No audit entries</p>
            ) : (
              <ul className="space-y-2 text-sm max-h-64 overflow-y-auto">
                {auditLogs.map((log) => (
                  <li key={log.id} className="flex justify-between border-b border-border/30 pb-2">
                    <span>{log.action} {log.actor && <span className="text-muted-foreground">by @{log.actor.username}</span>}</span>
                    <span className="text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmBan}
        onOpenChange={setConfirmBan}
        title="Ban user"
        description={`Ban @${user.username}?`}
        variant="destructive"
        loading={pending}
        onConfirm={() => run(() => banUser(user.id, "Admin panel"), "Banned")}
      />
    </div>
  );
}
