"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ModerationAction } from "@prisma/client";
import {
  moderateBanUser,
  moderateMuteUser,
  moderateResetWarnings,
  moderateRestoreUser,
  moderateSoftDeleteUser,
  moderateSuspendUser,
  moderateUnbanUser,
  moderateUnmuteUser,
  moderateUnsuspendUser,
  moderateWarnUser,
} from "@/actions/admin/moderation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { formatDateTime } from "@/lib/format-locale";
import { formatDisplayName } from "@/lib/display-name";

type UserRow = {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  role: string;
  isBanned: boolean;
  isSuspended: boolean;
  isMuted: boolean;
  warningCount: number;
  banReason: string | null;
  banExpiresAt: Date | null;
  bannedAt: Date | null;
  createdAt: Date;
};

type LogRow = {
  id: string;
  action: ModerationAction;
  reason: string | null;
  createdAt: Date;
  user: { username: string };
  actor: { username: string } | null;
};

const ACTION_LABELS: Record<ModerationAction, string> = {
  BAN_PERMANENT: "Permanent ban",
  BAN_TEMPORARY: "Temporary ban",
  UNBAN: "Unban",
  SUSPEND: "Suspend",
  UNSUSPEND: "Unsuspend",
  MUTE: "Mute",
  UNMUTE: "Unmute",
  WARN: "Warning",
  RESET_WARNINGS: "Reset warnings",
  SOFT_DELETE: "Delete account",
  RESTORE: "Restore account",
  ROLE_CHANGE: "Role change",
};

export function UserModerationPanel({
  locale,
  users,
  recentLogs,
  flagged,
}: {
  locale: string;
  users: UserRow[];
  recentLogs: LogRow[];
  flagged: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [duration, setDuration] = useState<"1d" | "3d" | "7d" | "30d" | "permanent">("7d");
  const [search, setSearch] = useState("");

  const selected = users.find((u) => u.id === selectedId) ?? null;

  function run(action: () => Promise<{ success: boolean; error?: string }>, successMsg: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        toast({ title: "Action failed", description: result.error, variant: "destructive" });
        return;
      }
      toast({ title: successMsg });
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">User Moderation</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage bans, suspensions, warnings, and account actions. {flagged} users currently flagged.
        </p>
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Users</CardTitle>
            <Input
              placeholder="Search username or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  router.push(`/${locale}/admin/moderation?search=${encodeURIComponent(search)}`);
                }
              }}
            />
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/40 max-h-[520px] overflow-y-auto">
              {users.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setSelectedId(u.id)}
                  className={`w-full text-left px-4 py-3 hover:bg-accent/10 transition-colors ${
                    selectedId === u.id ? "bg-accent/20" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{formatDisplayName(u)}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </div>
                    <div className="flex flex-wrap gap-1 justify-end shrink-0">
                      {u.isBanned && <Badge variant="destructive">Banned</Badge>}
                      {u.isSuspended && <Badge variant="secondary">Suspended</Badge>}
                      {u.isMuted && <Badge variant="outline">Muted</Badge>}
                      {u.warningCount > 0 && (
                        <Badge variant="outline">{u.warningCount} warn</Badge>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Moderation actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selected ? (
              <p className="text-sm text-muted-foreground">Select a user to apply moderation actions.</p>
            ) : (
              <>
                <div>
                  <p className="font-medium">{formatDisplayName(selected)}</p>
                  <Link
                    href={`/${locale}/admin/users/${selected.id}`}
                    className="text-xs text-neon-purple hover:underline"
                  >
                    View full profile
                  </Link>
                </div>

                <div className="space-y-2">
                  <label htmlFor="ban-reason" className="text-sm font-medium">
                    Reason (visible to user)
                  </label>
                  <Textarea
                    id="ban-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Describe the policy violation…"
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="internal-note" className="text-sm font-medium">
                    Internal note
                  </label>
                  <Textarea
                    id="internal-note"
                    value={internalNote}
                    onChange={(e) => setInternalNote(e.target.value)}
                    placeholder="Staff-only context…"
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="ban-duration" className="text-sm font-medium">
                    Ban duration
                  </label>
                  <select
                    id="ban-duration"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value as typeof duration)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="1d">1 day</option>
                    <option value="3d">3 days</option>
                    <option value="7d">7 days</option>
                    <option value="30d">30 days</option>
                    <option value="permanent">Permanent</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={pending || reason.length < 3}
                    onClick={() =>
                      run(
                        () =>
                          moderateBanUser({
                            userId: selected.id,
                            reason,
                            internalNote: internalNote || undefined,
                            duration,
                          }),
                        "User banned"
                      )
                    }
                  >
                    Ban
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => run(() => moderateUnbanUser(selected.id), "Ban lifted")}
                  >
                    Unban
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={pending || reason.length < 3}
                    onClick={() =>
                      run(() => moderateSuspendUser(selected.id, reason), "User suspended")
                    }
                  >
                    Suspend
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => run(() => moderateUnsuspendUser(selected.id), "Suspension lifted")}
                  >
                    Unsuspend
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => run(() => moderateMuteUser(selected.id, reason), "User muted")}
                  >
                    Mute
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => run(() => moderateUnmuteUser(selected.id), "User unmuted")}
                  >
                    Unmute
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending || reason.length < 3}
                    onClick={() => run(() => moderateWarnUser(selected.id, reason), "Warning issued")}
                  >
                    Warn
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => run(() => moderateResetWarnings(selected.id), "Warnings reset")}
                  >
                    Reset warnings
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={pending || reason.length < 3}
                    onClick={() =>
                      run(() => moderateSoftDeleteUser(selected.id, reason), "Account deleted")
                    }
                  >
                    Delete
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => run(() => moderateRestoreUser(selected.id), "Account restored")}
                  >
                    Restore
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent moderation log</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            {recentLogs.length === 0 ? (
              <p className="text-muted-foreground">No moderation events recorded yet.</p>
            ) : (
              recentLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-border/30 pb-2"
                >
                  <div>
                    <span className="font-medium">{ACTION_LABELS[log.action]}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {log.user.username}
                      {log.actor ? ` · by ${log.actor.username}` : ""}
                    </span>
                    {log.reason && (
                      <p className="text-xs text-muted-foreground mt-0.5">{log.reason}</p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatDateTime(log.createdAt, locale)}
                  </span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
