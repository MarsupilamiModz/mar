"use client";

import { memo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  addTeamMemberAdmin,
  removeFromTeamAdmin,
  searchUsersForTeamAdmin,
  updateTeamMemberAdmin,
} from "@/actions/admin/team";
import type { UserRole } from "@prisma/client";

type Member = {
  id: string;
  username: string;
  displayName: string | null;
  email: string;
  role: UserRole;
  teamDepartment: string | null;
  teamBadge: string | null;
  permissionGroupId: string | null;
  permissionGroup: { id: string; name: string; color: string | null } | null;
};

type Group = { id: string; name: string; color: string | null };

function TeamAdminPanelInner({
  members,
  groups,
  departments,
}: {
  members: Member[];
  groups: Group[];
  departments: readonly string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<
    { id: string; username: string; email: string; displayName: string | null }[]
  >([]);

  function saveMember(id: string, patch: Parameters<typeof updateTeamMemberAdmin>[1]) {
    startTransition(async () => {
      const r = await updateTeamMemberAdmin(id, patch);
      if (r.success) {
        toast({ title: "Team member updated" });
        router.refresh();
      } else toast({ title: r.error, variant: "destructive" });
    });
  }

  return (
    <div className="space-y-6">
      <Card className="glass">
        <CardHeader>
          <CardTitle>Add team member</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Search users by username or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button
              variant="outline"
              disabled={pending || search.length < 2}
              onClick={() =>
                startTransition(async () => {
                  const r = await searchUsersForTeamAdmin(search);
                  if (r.success) setSearchResults(r.data);
                })
              }
            >
              Search
            </Button>
          </div>
          {searchResults.map((u) => (
            <div key={u.id} className="flex items-center justify-between text-sm border-b border-border/30 pb-2">
              <span>{u.displayName ?? u.username} · {u.email}</span>
              <Button
                size="sm"
                variant="neon"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const r = await addTeamMemberAdmin({ userId: u.id, role: "SUPPORT" });
                    if (r.success) {
                      toast({ title: "Added to team" });
                      setSearchResults([]);
                      router.refresh();
                    } else toast({ title: r.error, variant: "destructive" });
                  })
                }
              >
                Add
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle>Team ({members.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">No team members yet.</p>
          ) : (
            members.map((m) => (
              <div key={m.id} className="grid gap-2 border border-border/30 rounded-lg p-3 sm:grid-cols-2">
                <div>
                  <p className="font-medium">{m.displayName ?? m.username}</p>
                  <p className="text-xs text-muted-foreground">{m.email}</p>
                  <div className="flex gap-1 mt-1">
                    <Badge variant="outline">{m.role}</Badge>
                    {m.teamBadge && <Badge>{m.teamBadge}</Badge>}
                    {m.permissionGroup && (
                      <Badge variant="secondary">{m.permissionGroup.name}</Badge>
                    )}
                  </div>
                </div>
                <div className="grid gap-2">
                  <select
                    className="h-9 rounded-md border border-input bg-background/50 px-2 text-sm"
                    defaultValue={m.role}
                    onChange={(e) => saveMember(m.id, { role: e.target.value as UserRole })}
                  >
                    <option value="ADMIN">Admin</option>
                    <option value="MODERATOR">Moderator</option>
                    <option value="SUPPORT">Support</option>
                  </select>
                  <select
                    className="h-9 rounded-md border border-input bg-background/50 px-2 text-sm"
                    defaultValue={m.teamDepartment ?? ""}
                    onChange={(e) => saveMember(m.id, { teamDepartment: e.target.value || null })}
                  >
                    <option value="">No department</option>
                    {departments.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  <select
                    className="h-9 rounded-md border border-input bg-background/50 px-2 text-sm"
                    defaultValue={m.permissionGroupId ?? ""}
                    onChange={(e) =>
                      saveMember(m.id, { permissionGroupId: e.target.value || null })
                    }
                  >
                    <option value="">No group</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                  <Input
                    placeholder="Badge label"
                    defaultValue={m.teamBadge ?? ""}
                    onBlur={(e) => saveMember(m.id, { teamBadge: e.target.value || null })}
                  />
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        if (!confirm("Remove from team?")) return;
                        const r = await removeFromTeamAdmin(m.id);
                        if (r.success) router.refresh();
                        else toast({ title: r.error, variant: "destructive" });
                      })
                    }
                  >
                    Remove from team
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export const TeamAdminPanel = memo(TeamAdminPanelInner);
