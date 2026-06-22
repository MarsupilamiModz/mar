"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { UserRole } from "@prisma/client";
import { getOwnerUserManagementOverview, ownerCreateUser } from "@/actions/admin/owner-users";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDisplayName } from "@/lib/display-name";
import { formatRoleLabel, roleBadgeVariant } from "@/lib/role-display";
import { useAppToast } from "@/hooks/use-app-toast";
import { ASSIGNABLE_ROLES } from "@/lib/permission-types";

type OverviewData = {
  users: {
    id: string;
    username: string;
    email: string;
    displayName: string | null;
    avatarUrl: string | null;
    role: UserRole;
    isBanned: boolean;
    isSuspended: boolean;
    uploadBanned: boolean;
    commentBanned: boolean;
    createdAt: Date;
    userMembership: { membershipType: string; status: string } | null;
    permissionGroup: { name: string } | null;
  }[];
  total: number;
  pages: number;
  page: number;
  stats: {
    totalUsers: number;
    bannedUsers: number;
    pendingCreators: number;
    pendingPartners: number;
    openTickets: number;
    openReports: number;
  };
};

export function OwnerUserManagementClient({
  locale,
  initial,
}: {
  locale: string;
  initial: OverviewData;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const appToast = useAppToast();
  const [pending, startTransition] = useTransition();
  const [data, setData] = useState(initial);
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newUsername, setNewUsername] = useState("");

  const load = useCallback(
    (params: { page?: number; q?: string; role?: string; banned?: string }) => {
      startTransition(async () => {
        const r = await getOwnerUserManagementOverview({
          page: params.page ?? data.page,
          search: params.q ?? (search || undefined),
          role: params.role as UserRole | undefined,
          banned:
            params.banned === "banned" ? true : params.banned === "active" ? false : undefined,
        });
        if (r.success) setData(r.data);
      });
    },
    [data.page, search]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Owner · User Management</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Full account control — roles, permissions, premium, bans, and audit history.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {[
          ["Total users", data.stats.totalUsers],
          ["Banned", data.stats.bannedUsers],
          ["Creator apps", data.stats.pendingCreators],
          ["Partner apps", data.stats.pendingPartners],
          ["Open tickets", data.stats.openTickets],
          ["Open reports", data.stats.openReports],
        ].map(([label, value]) => (
          <Card key={String(label)} className="glass p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search users…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                router.push(`/${locale}/admin/owner/users?q=${encodeURIComponent(search)}`);
                load({ q: search, page: 1 });
              }
            }}
          />
        </div>
        <Button variant="outline" disabled={pending} onClick={() => load({ q: search, page: 1 })}>
          Search
        </Button>
        <Button variant="neon" onClick={() => setShowCreate((v) => !v)}>
          Create user
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/${locale}/admin/applications`}>Applications</Link>
        </Button>
      </div>

      {showCreate && (
        <Card className="glass p-4 space-y-3">
          <p className="font-medium text-sm">Create account (Supabase + Prisma)</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input placeholder="Email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            <Input placeholder="Username (optional)" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} />
          </div>
          <Button
            variant="neon"
            size="sm"
            disabled={pending || !newEmail}
            onClick={() =>
              startTransition(async () => {
                const r = await ownerCreateUser({
                  email: newEmail,
                  username: newUsername || undefined,
                });
                if (!r.success) {
                  appToast.error(r.error);
                  return;
                }
                appToast.saved();
                setShowCreate(false);
                setNewEmail("");
                setNewUsername("");
                router.push(`/${locale}/admin/owner/users/${r.data.id}`);
              })
            }
          >
            Create
          </Button>
        </Card>
      )}

      <Card className="glass overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Membership</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.users.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <UserAvatar src={u.avatarUrl} name={formatDisplayName(u)} className="h-9 w-9" />
                    <div>
                      <p className="font-medium">{formatDisplayName(u)}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={roleBadgeVariant(u.role)}>{formatRoleLabel(u.role)}</Badge>
                </TableCell>
                <TableCell className="text-sm">
                  {u.userMembership?.membershipType ?? "FREE"}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {u.isBanned && <Badge variant="destructive">Banned</Badge>}
                    {u.isSuspended && <Badge variant="outline">Suspended</Badge>}
                    {u.uploadBanned && <Badge variant="outline">No uploads</Badge>}
                    {u.commentBanned && <Badge variant="outline">No comments</Badge>}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/${locale}/admin/owner/users/${u.id}`}>Manage</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {data.pages > 1 && (
        <div className="flex gap-2 justify-center">
          <Button
            variant="outline"
            size="sm"
            disabled={pending || data.page <= 1}
            onClick={() => load({ page: data.page - 1 })}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground self-center">
            Page {data.page} / {data.pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={pending || data.page >= data.pages}
            onClick={() => load({ page: data.page + 1 })}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
