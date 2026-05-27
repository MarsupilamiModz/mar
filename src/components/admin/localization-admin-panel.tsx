"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAppToast } from "@/hooks/use-app-toast";
import { runTranslationJob, approveTranslationJob } from "@/actions/admin/localization";

type Job = {
  id: string;
  entityType: string;
  field: string;
  sourceLocale: string;
  targetLocale: string;
  sourceText: string;
  translatedText: string | null;
  status: string;
};

export function LocalizationAdminPanel({ jobs }: { jobs: Job[] }) {
  const appToast = useAppToast();
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      {jobs.length === 0 && (
        <Card className="glass p-6 text-sm text-muted-foreground">No translation jobs queued.</Card>
      )}
      {jobs.map((job) => (
        <Card key={job.id} className="glass p-4 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{job.status}</Badge>
            <span className="text-xs text-muted-foreground">
              {job.entityType}.{job.field} · {job.sourceLocale} → {job.targetLocale}
            </span>
          </div>
          <p className="text-sm line-clamp-2">{job.sourceText}</p>
          {job.translatedText && (
            <p className="text-sm text-neon-blue/90 line-clamp-2">{job.translatedText}</p>
          )}
          <div className="flex gap-2">
            {job.status === "PENDING" && (
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const r = await runTranslationJob(job.id);
                    if (r.success) appToast.saved();
                    else appToast.error(r.error);
                  })
                }
              >
                Run AI translation
              </Button>
            )}
            {job.status === "COMPLETED" && (
              <Button
                size="sm"
                variant="neon"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const r = await approveTranslationJob(job.id);
                    if (r.success) appToast.saved();
                    else appToast.error(r.error);
                  })
                }
              >
                Approve
              </Button>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
