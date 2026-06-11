import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PartnerApplication } from "@prisma/client";

type StatusEvent = {
  status: string;
  at: string;
  note?: string;
};

function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "APPROVED") return "default";
  if (status === "REJECTED") return "destructive";
  if (status === "NEEDS_CHANGES") return "secondary";
  return "outline";
}

export function PartnerApplicationStatus({
  application,
}: {
  application: PartnerApplication;
}) {
  const history = (application.statusHistory as StatusEvent[] | null) ?? [];

  return (
    <Card className="glass max-w-2xl">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Badge variant={statusVariant(application.status)}>{statusLabel(application.status)}</Badge>
          <span className="text-sm text-muted-foreground">
            Submitted {new Date(application.createdAt).toLocaleDateString()}
          </span>
        </div>
        <CardTitle>Partner application</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {application.requiredChanges && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
            <p className="font-medium text-amber-200">Required changes</p>
            <p className="mt-1 text-muted-foreground whitespace-pre-wrap">{application.requiredChanges}</p>
          </div>
        )}

        {application.adminNotes && (
          <div className="rounded-lg border border-border/40 p-3">
            <p className="font-medium">Review notes</p>
            <p className="mt-1 text-muted-foreground whitespace-pre-wrap">{application.adminNotes}</p>
          </div>
        )}

        {application.reviewedAt && (
          <p className="text-muted-foreground">
            Last reviewed {new Date(application.reviewedAt).toLocaleString()}
          </p>
        )}

        {history.length > 0 && (
          <div>
            <p className="font-medium mb-2">Status history</p>
            <ul className="space-y-2">
              {[...history].reverse().map((event, i) => (
                <li key={`${event.at}-${i}`} className="border-l-2 border-neon-purple/40 pl-3">
                  <span className="font-medium">{statusLabel(event.status)}</span>
                  <span className="text-muted-foreground"> · {new Date(event.at).toLocaleString()}</span>
                  {event.note && <p className="text-muted-foreground mt-0.5">{event.note}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
