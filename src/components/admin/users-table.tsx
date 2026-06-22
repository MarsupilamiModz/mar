"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { safeToLocaleDateString } from "@/lib/i18n/safe-locale";
import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import { UserRole } from "@prisma/client";
import { MoreHorizontal, Search } from "lucide-react";
import {
  banUser,
  getUsers,
  permanentlyDeleteUser,
  setUserPremium,
  softDeleteUser,
  unbanUser,
  updateUserRole,
} from "@/actions/admin/users";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { toast } from "@/hooks/use-toast";
import { ASSIGNABLE_ROLES } from "@/lib/permission-types";
import { formatDisplayName } from "@/lib/display-name";
import { formatRoleLabel, roleBadgeVariant } from "@/lib/role-display";
import { AdminPagination } from "@/components/admin/admin-pagination";
import type { AdminPageSize } from "@/lib/admin-pagination";
import { Skeleton } from "@/components/ui/skeleton";

type UserRow = {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: UserRole;
  isBanned: boolean;
  isPremium: boolean;
  discordId: string | null;
  createdAt: Date;
};

export function UsersTable({
  locale,
  initialUsers,
  initialTotal,
  initialPages,
  initialPage,
  initialLimit,
  initialQuery = {},
}: {
  locale: string;
  initialUsers: UserRow[];
  initialTotal: number;
  initialPages: number;
  initialPage: number;
  initialLimit: number;
  initialQuery?: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [users, setUsers] = useState(initialUsers);
  const [total, setTotal] = useState(initialTotal);
  const [pages, setPages] = useState(initialPages);
  const [page, setPage] = useState(initialPage);
  const [limit, setLimit] = useState(initialLimit);
  const [search, setSearch] = useState(searchParams.get("q") ?? initialQuery.q ?? "");
  const [roleFilter, setRoleFilter] = useState(searchParams.get("role") ?? initialQuery.role ?? "all");
  const [bannedFilter, setBannedFilter] = useState(searchParams.get("banned") ?? initialQuery.banned ?? "all");
  const [deletedFilter, setDeletedFilter] = useState(searchParams.get("deleted") ?? initialQuery.deleted ?? "0");
  const [confirm, setConfirm] = useState<{
    type: "ban" | "delete" | "permanent";
    userId: string;
    username: string;
  } | null>(null);

  const refresh = useCallback(
    (p = page, nextLimit = limit) => {
      startTransition(async () => {
        const result = await getUsers({
          page: p,
          limit: nextLimit,
          search: search || undefined,
          role: roleFilter !== "all" ? (roleFilter as UserRole) : undefined,
          banned: bannedFilter === "banned" ? true : bannedFilter === "active" ? false : undefined,
          includeDeleted: deletedFilter === "1",
        });
        if (result.success) {
          setUsers(result.data.users as UserRow[]);
          setTotal(result.data.total);
          setPages(result.data.pages);
          setPage(result.data.page);
          setLimit(result.data.limit ?? nextLimit);
        }
      });
    },
    [page, limit, search, roleFilter, bannedFilter, deletedFilter]
  );

  async function handleAction(
    action: () => Promise<{ success: boolean; error?: string }>,
    successMsg: string
  ) {
    const result = await action();
    if (result.success) {
      toast({ title: successMsg });
      refresh();
      router.refresh();
    } else {
      toast({ title: "Error", description: result.error, variant: "destructive" });
    }
  }

  function applyFilters() {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (roleFilter !== "all") params.set("role", roleFilter);
    if (bannedFilter !== "all") params.set("banned", bannedFilter);
    if (deletedFilter === "1") params.set("deleted", "1");
    if (limit !== 25) params.set("limit", String(limit));
    router.push(`/${locale}/admin/users?${params.toString()}`);
    refresh(1);
  }

  function goToPage(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    router.push(`/${locale}/admin/users?${params.toString()}`);
    refresh(p);
  }

  function changeLimit(nextLimit: AdminPageSize) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("limit", String(nextLimit));
    params.delete("page");
    router.push(`/${locale}/admin/users?${params.toString()}`);
    refresh(1, nextLimit);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {ASSIGNABLE_ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {formatRoleLabel(r)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={bannedFilter} onValueChange={setBannedFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="banned">Banned</SelectItem>
          </SelectContent>
        </Select>
        <Select value={deletedFilter} onValueChange={setDeletedFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Deleted" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Hide deleted</SelectItem>
            <SelectItem value="1">Include deleted</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="neon" onClick={applyFilters} disabled={pending}>
          Filter
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">{total} users</p>

      <div className="glass rounded-xl border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Avatar</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Display name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Premium</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Registered</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pending && users.length === 0 ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={9}>
                    <Skeleton className="h-10 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <UserAvatar src={u.avatarUrl} name={u.displayName ?? u.username} className="h-8 w-8" />
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/${locale}/admin/users/${u.id}`}
                      className="font-medium hover:text-neon-purple"
                    >
                      @{u.username}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">{formatDisplayName(u)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    <Badge variant={roleBadgeVariant(u.role)}>{formatRoleLabel(u.role)}</Badge>
                  </TableCell>
                  <TableCell>
                    {u.isPremium ? (
                      <Badge variant="premium">Premium</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {u.isBanned ? (
                      <Badge variant="destructive">Banned</Badge>
                    ) : (
                      <Badge variant="free">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {safeToLocaleDateString(new Date(u.createdAt))}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="glass">
                        <DropdownMenuItem asChild>
                          <Link href={`/${locale}/admin/users/${u.id}`}>View profile</Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {ASSIGNABLE_ROLES.map(
                          (role) => (
                            <DropdownMenuItem
                              key={role}
                              onClick={() =>
                                handleAction(
                                  () => updateUserRole(u.id, role),
                                  `Role updated to ${formatRoleLabel(role)}`
                                )
                              }
                            >
                              Set {formatRoleLabel(role)}
                            </DropdownMenuItem>
                          )
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() =>
                            handleAction(
                              () => setUserPremium(u.id, !u.isPremium),
                              u.isPremium ? "Premium removed" : "Premium granted"
                            )
                          }
                        >
                          {u.isPremium ? "Remove premium" : "Grant premium"}
                        </DropdownMenuItem>
                        {u.isBanned ? (
                          <DropdownMenuItem
                            onClick={() => handleAction(() => unbanUser(u.id), "User unbanned")}
                          >
                            Unban
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() => setConfirm({ type: "ban", userId: u.id, username: u.username })}
                          >
                            Ban user
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => setConfirm({ type: "delete", userId: u.id, username: u.username })}
                        >
                          Soft delete
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() =>
                            setConfirm({ type: "permanent", userId: u.id, username: u.username })
                          }
                        >
                          Delete permanently
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AdminPagination
        page={page}
        pages={pages}
        total={total}
        limit={limit as AdminPageSize}
        onPageChange={goToPage}
        onLimitChange={changeLimit}
        disabled={pending}
      />

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={() => setConfirm(null)}
        title={
          confirm?.type === "ban"
            ? "Ban user"
            : confirm?.type === "permanent"
              ? "Permanently delete"
              : "Soft delete user"
        }
        description={`Are you sure you want to ${confirm?.type === "ban" ? "ban" : "delete"} @${confirm?.username}?`}
        confirmLabel="Confirm"
        variant="destructive"
        loading={pending}
        onConfirm={async () => {
          if (!confirm) return;
          if (confirm.type === "ban") {
            await handleAction(() => banUser(confirm.userId, "Admin action"), "User banned");
          } else if (confirm.type === "permanent") {
            await handleAction(() => permanentlyDeleteUser(confirm.userId), "User deleted");
          } else {
            await handleAction(() => softDeleteUser(confirm.userId), "User soft deleted");
          }
          setConfirm(null);
        }}
      />
    </div>
  );
}
