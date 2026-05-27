"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCommissionRule, toggleCommissionRule, markPayoutPaid } from "@/actions/admin/commissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAppToast } from "@/hooks/use-app-toast";
import { formatCents } from "@/lib/affiliate";

type Rule = {
  id: string;
  name: string;
  source: string;
  type: string;
  value: number;
  isActive: boolean;
};

type Payout = {
  id: string;
  amountCents: number;
  status: string;
  user: { username: string };
};

export function CommissionsAdminPanel({
  locale,
  rules: initialRules,
  payouts: initialPayouts,
}: {
  locale: string;
  rules: Rule[];
  payouts: Payout[];
}) {
  const router = useRouter();
  const appToast = useAppToast();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [value, setValue] = useState("1000");
  const [type, setType] = useState<"PERCENT" | "FIXED">("PERCENT");
  const [source, setSource] = useState<"SUBSCRIPTION" | "MOD_SALE" | "COUPON">("SUBSCRIPTION");

  const createRule = () => {
    if (!name.trim()) return;
    startTransition(async () => {
      const r = await createCommissionRule({
        name: name.trim(),
        type,
        value: Number(value),
        source,
        isActive: true,
      });
      if (r.success) { appToast.saved(); setName(""); router.refresh(); }
      else appToast.error(r.error);
    });
  };

  return (
    <div className="space-y-8">
      <Card className="glass p-6 space-y-3">
        <h3 className="font-semibold">Create commission rule</h3>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Rule name" />
        <div className="flex flex-wrap gap-2">
          <select value={type} onChange={(e) => setType(e.target.value as "PERCENT" | "FIXED")} className="h-10 rounded-md border border-input bg-background/50 px-3 text-sm">
            <option value="PERCENT">Percent (bps)</option>
            <option value="FIXED">Fixed (cents)</option>
          </select>
          <select value={source} onChange={(e) => setSource(e.target.value as typeof source)} className="h-10 rounded-md border border-input bg-background/50 px-3 text-sm">
            <option value="SUBSCRIPTION">Membership purchase</option>
            <option value="MOD_SALE">Mod sale</option>
            <option value="COUPON">Coupon</option>
          </select>
          <Input value={value} onChange={(e) => setValue(e.target.value)} type="number" className="max-w-[120px]" />
          <Button variant="neon" disabled={pending} onClick={createRule}>Add rule</Button>
        </div>
      </Card>

      <section className="space-y-2">
        {initialRules.map((r) => (
          <Card key={r.id} className="glass p-4 flex justify-between items-center">
            <div>
              <p className="font-medium">{r.name}</p>
              <p className="text-xs text-muted-foreground">{r.source} · {r.type}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm">{r.type === "FIXED" ? formatCents(r.value, locale) : `${r.value / 100}%`}</span>
              <Button size="sm" variant="outline" disabled={pending} onClick={() => startTransition(async () => {
                const r2 = await toggleCommissionRule(r.id, !r.isActive);
                if (r2.success) router.refresh();
              })}>
                {r.isActive ? "Disable" : "Enable"}
              </Button>
            </div>
          </Card>
        ))}
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold">Payouts</h3>
        {initialPayouts.map((p) => (
          <Card key={p.id} className="glass p-4 flex justify-between items-center">
            <span>@{p.user.username}</span>
            <div className="flex items-center gap-3">
              <span>{formatCents(p.amountCents, locale)}</span>
              <Badge variant="outline">{p.status}</Badge>
              {p.status === "PROCESSING" && (
                <Button size="sm" variant="neon" disabled={pending} onClick={() => startTransition(async () => {
                  const r = await markPayoutPaid(p.id);
                  if (r.success) router.refresh();
                })}>Mark paid</Button>
              )}
            </div>
          </Card>
        ))}
      </section>
    </div>
  );
}
