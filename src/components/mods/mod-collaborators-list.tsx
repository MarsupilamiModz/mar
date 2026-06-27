import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserIdentity } from "@/components/user/user-identity";

const ROLE_LABELS: Record<string, string> = {
  LEAD_CREATOR: "Lead Creator",
  DEVELOPER: "Developer",
  SCRIPTER: "Scripter",
  MODELER: "Modeler",
  DESIGNER: "Designer",
  SOUND_DESIGNER: "Sound Designer",
  TESTER: "Tester",
};

export async function ModCollaboratorsList({ modId }: { modId: string }) {
  const collaborators = await prisma.modCollaborator.findMany({
    where: { modId, isPublic: true },
    include: {
      user: { select: { username: true, displayName: true } },
    },
    orderBy: { revenueShareBps: "desc" },
  });

  if (collaborators.length === 0) return null;

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="text-lg">Co-Creators</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {collaborators.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-3">
            <UserIdentity username={c.user.username} displayName={c.user.displayName} size="sm" />
            <div className="flex items-center gap-2">
              <Badge variant="outline">{ROLE_LABELS[c.role] ?? c.role}</Badge>
              {c.revenueShareBps > 0 ? (
                <span className="text-xs text-muted-foreground">
                  {(c.revenueShareBps / 100).toFixed(0)}%
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
