"use client";

import { memo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  reviewCreatorApplicationAdmin,
  reviewPartnerApplicationAdmin,
} from "@/actions/admin/applications";

type CreatorApp = {
  id: string;
  status: string;
  displayName: string;
  email: string;
  discord: string | null;
  message: string | null;
  portfolioUrl: string | null;
  createdAt: Date;
  adminNotes: string | null;
  user: { username: string; email: string };
};

type PartnerApp = {
  id: string;
  status: string;
  creatorName: string;
  username: string | null;
  email: string;
  discord: string | null;
  audienceSize: string | null;
  whyPartner: string | null;
  promotionStrategy: string | null;
  youtubeUrl: string | null;
  twitchUrl: string | null;
  websiteUrl: string | null;
  adminNotes: string | null;
  user: { username: string; email: string; displayName: string | null };
  assignedCommissionRule: { id: string; name: string } | null;
};

type CommissionRuleOption = {
  id: string;
  name: string;
  type: string;
  value: number;
  source: string;
};

function ApplicationsAdminPanelInner({
  creatorApps,
  partnerApps,
  commissionRules,
}: {
  creatorApps: CreatorApp[];
  partnerApps: PartnerApp[];
  commissionRules: CommissionRuleOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [partnerCodes, setPartnerCodes] = useState<
    Record<string, { creator?: string; partner?: string; commissionRuleId?: string }>
  >({});

  function reviewCreator(id: string, action: "approve" | "reject" | "info") {
    startTransition(async () => {
      const r = await reviewCreatorApplicationAdmin(id, action, notes[id]);
      if (r.success) {
        toast({ title: "Updated" });
        router.refresh();
      } else toast({ title: r.error, variant: "destructive" });
    });
  }

  function reviewPartner(id: string, action: "approve" | "reject" | "info" | "needs_changes") {
    startTransition(async () => {
      const codes = partnerCodes[id];
      const r = await reviewPartnerApplicationAdmin(id, action, {
        adminNotes: notes[id],
        requiredChanges: notes[id],
        creatorCode: codes?.creator,
        partnerCode: codes?.partner,
        commissionRuleId: codes?.commissionRuleId,
      });
      if (r.success) {
        toast({ title: "Updated" });
        router.refresh();
      } else toast({ title: r.error, variant: "destructive" });
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <Card className="glass">
        <CardHeader><CardTitle>Creator applications ({creatorApps.length})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {creatorApps.length === 0 ? (
            <p className="text-sm text-muted-foreground">No applications.</p>
          ) : (
            creatorApps.map((a) => (
              <div key={a.id} className="border-b border-border/30 pb-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{a.displayName}</span>
                  <Badge variant="outline">{a.status}</Badge>
                </div>
                <p className="text-muted-foreground">{a.email} · @{a.user.username}</p>
                {a.discord && <p className="text-xs text-muted-foreground">Discord: {a.discord}</p>}
                {a.message && <p className="mt-1 line-clamp-2">{a.message}</p>}
                {a.portfolioUrl && (
                  <a href={a.portfolioUrl} target="_blank" rel="noreferrer" className="text-xs text-neon-purple hover:underline">
                    Portfolio
                  </a>
                )}
                {a.adminNotes && <p className="text-xs mt-1 italic">Notes: {a.adminNotes}</p>}
                {(a.status === "PENDING" || a.status === "UNDER_REVIEW") && (
                  <div className="mt-2 space-y-2">
                    <Textarea
                      placeholder="Admin notes / request more info"
                      rows={2}
                      value={notes[a.id] ?? ""}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [a.id]: e.target.value }))}
                    />
                    <div className="flex gap-1">
                      <Button size="sm" variant="neon" disabled={pending} onClick={() => reviewCreator(a.id, "approve")}>Approve</Button>
                      <Button size="sm" variant="outline" disabled={pending} onClick={() => reviewCreator(a.id, "info")}>Request info</Button>
                      <Button size="sm" variant="destructive" disabled={pending} onClick={() => reviewCreator(a.id, "reject")}>Reject</Button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader><CardTitle>Partner applications ({partnerApps.length})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {partnerApps.length === 0 ? (
            <p className="text-sm text-muted-foreground">No applications.</p>
          ) : (
            partnerApps.map((a) => (
              <div key={a.id} className="border-b border-border/30 pb-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{a.creatorName}</span>
                  <Badge variant="outline">{a.status}</Badge>
                </div>
                <p className="text-muted-foreground">
                  {a.email} · @{a.username ?? a.user.username} · {a.audienceSize ?? "—"} audience
                </p>
                {a.discord && <p className="text-xs text-muted-foreground">Discord: {a.discord}</p>}
                {a.whyPartner && <p className="mt-1 line-clamp-3">{a.whyPartner}</p>}
                {a.promotionStrategy && <p className="mt-1 line-clamp-2 text-muted-foreground">{a.promotionStrategy}</p>}
                {(a.youtubeUrl || a.websiteUrl) && (
                  <p className="text-xs text-neon-purple mt-1">
                    {[a.youtubeUrl, a.twitchUrl, a.websiteUrl].filter(Boolean).join(" · ")}
                  </p>
                )}
                {a.assignedCommissionRule && (
                  <p className="text-xs mt-1">Plan: {a.assignedCommissionRule.name}</p>
                )}
                {a.adminNotes && <p className="text-xs mt-1 italic">Notes: {a.adminNotes}</p>}
                {(a.status === "PENDING" || a.status === "UNDER_REVIEW" || a.status === "NEEDS_CHANGES") && (
                  <div className="mt-2 space-y-2">
                    <Textarea
                      placeholder="Admin notes / required changes"
                      rows={2}
                      value={notes[a.id] ?? ""}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [a.id]: e.target.value }))}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Creator code"
                        value={partnerCodes[a.id]?.creator ?? ""}
                        onChange={(e) =>
                          setPartnerCodes((prev) => ({
                            ...prev,
                            [a.id]: { ...prev[a.id], creator: e.target.value },
                          }))
                        }
                      />
                      <Input
                        placeholder="Partner code"
                        value={partnerCodes[a.id]?.partner ?? ""}
                        onChange={(e) =>
                          setPartnerCodes((prev) => ({
                            ...prev,
                            [a.id]: { ...prev[a.id], partner: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <select
                      className="h-10 w-full rounded-md border border-input bg-background/50 px-3 text-sm"
                      value={partnerCodes[a.id]?.commissionRuleId ?? ""}
                      onChange={(e) =>
                        setPartnerCodes((prev) => ({
                          ...prev,
                          [a.id]: { ...prev[a.id], commissionRuleId: e.target.value || undefined },
                        }))
                      }
                    >
                      <option value="">Commission plan (optional)</option>
                      {commissionRules.map((rule) => (
                        <option key={rule.id} value={rule.id}>
                          {rule.name} ({rule.type} {rule.value})
                        </option>
                      ))}
                    </select>
                    <div className="flex flex-wrap gap-1">
                      <Button size="sm" variant="neon" disabled={pending} onClick={() => reviewPartner(a.id, "approve")}>Approve</Button>
                      <Button size="sm" variant="outline" disabled={pending} onClick={() => reviewPartner(a.id, "info")}>Under review</Button>
                      <Button size="sm" variant="outline" disabled={pending} onClick={() => reviewPartner(a.id, "needs_changes")}>Request changes</Button>
                      <Button size="sm" variant="destructive" disabled={pending} onClick={() => reviewPartner(a.id, "reject")}>Reject</Button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export const ApplicationsAdminPanel = memo(ApplicationsAdminPanelInner);
