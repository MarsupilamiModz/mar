import { ShieldCheck, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SoundApprovalStatus, FileScanStatus } from "@prisma/client";

type Props = {
  approvalStatus: SoundApprovalStatus;
  previewScanStatus: FileScanStatus;
  approvedAt?: Date | null;
};

export function SoundApprovalPanel({ approvalStatus, previewScanStatus, approvedAt }: Props) {
  const isApproved =
    approvalStatus === "MANUALLY_APPROVED" || approvalStatus === "VIRUS_TOTAL_VERIFIED";
  const isRejected = approvalStatus === "REJECTED";
  const isPending = !isApproved && !isRejected;

  return (
    <Card className={`glass ${isApproved ? "border-emerald-500/20" : isRejected ? "border-destructive/30" : "border-amber-500/20"}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {isApproved ? (
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
          ) : (
            <ShieldAlert className="h-4 w-4 text-amber-400" />
          )}
          Sound security
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {isApproved && (
          <div className="space-y-1">
            <p className="font-medium text-emerald-400">✔ Approved</p>
            {approvalStatus === "MANUALLY_APPROVED" && (
              <p className="text-emerald-400/90">✔ Manually approved by moderation team</p>
            )}
            {approvalStatus === "VIRUS_TOTAL_VERIFIED" && (
              <p className="text-emerald-400/90">✔ VirusTotal verified</p>
            )}
            {(previewScanStatus === "CLEAN" || previewScanStatus === "APPROVED") && (
              <p className="text-emerald-400/90">✔ Scan passed</p>
            )}
          </div>
        )}
        {isPending && (
          <p className="text-amber-400">Awaiting moderation review — preview is available.</p>
        )}
        {isRejected && (
          <p className="text-destructive">This sound was rejected and is not available for playback.</p>
        )}
        {approvedAt && isApproved && (
          <p className="text-xs text-muted-foreground pt-2 border-t border-border/30">
            Approved {approvedAt.toLocaleDateString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
