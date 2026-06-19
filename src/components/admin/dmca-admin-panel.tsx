"use client";

import { useTransition } from "react";
import { safeToLocaleDateString } from "@/lib/i18n/safe-locale";
import { DMCAStatus } from "@prisma/client";
import { updateDMCAStatus } from "@/actions/admin/trust";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

type Claim = {
  id: string;
  companyName: string;
  legalName: string;
  contactEmail: string;
  infringingUrl: string;
  description: string;
  status: DMCAStatus;
  createdAt: Date;
};

const STATUSES: DMCAStatus[] = ["SUBMITTED", "LEGAL_REVIEW", "ACCEPTED", "REMOVED", "REJECTED"];

export function DMCAAdminPanel({ claims }: { claims: Claim[] }) {
  const [pending, startTransition] = useTransition();

  function setStatus(id: string, status: DMCAStatus) {
    startTransition(async () => {
      const r = await updateDMCAStatus(id, status);
      if (r.success) {
        toast({ title: "DMCA status updated" });
        window.location.reload();
      } else toast({ title: "Error", description: r.error, variant: "destructive" });
    });
  }

  if (claims.length === 0) {
    return <p className="text-sm text-muted-foreground">No DMCA claims.</p>;
  }

  return (
    <div className="space-y-4">
      {claims.map((c) => (
        <Card key={c.id} className="glass">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap gap-2 items-center">
              <CardTitle className="text-sm">{c.companyName}</CardTitle>
              <Badge variant="outline">{c.status}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {c.contactEmail} · {safeToLocaleDateString(new Date(c.createdAt))}
            </p>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">Legal name:</span> {c.legalName}</p>
            <p><span className="text-muted-foreground">URL:</span> {c.infringingUrl}</p>
            <p className="whitespace-pre-wrap">{c.description}</p>
            <Select value={c.status} onValueChange={(v) => setStatus(c.id, v as DMCAStatus)} disabled={pending}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
