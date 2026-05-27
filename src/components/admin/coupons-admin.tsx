"use client";

import { useState, useTransition } from "react";
import { createCoupon, toggleCoupon, deleteCoupon } from "@/actions/admin/coupons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

type Coupon = {
  id: string;
  code: string;
  type: string;
  value: number;
  usedCount: number;
  maxUses: number | null;
  isActive: boolean;
  appliesTo: string;
};

export function CouponsAdmin({ initialCoupons }: { initialCoupons: Coupon[] }) {
  const [coupons, setCoupons] = useState(initialCoupons);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-6">
      <Card className="glass p-6">
        <h3 className="font-medium mb-4">Create coupon</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(async () => {
              const r = await createCoupon({
                code: fd.get("code") as string,
                type: fd.get("type") as "PERCENT" | "FIXED",
                value: Number(fd.get("value")),
                maxUses: fd.get("maxUses") ? Number(fd.get("maxUses")) : undefined,
                appliesTo: (fd.get("appliesTo") as string) || "all",
              });
              if (r.success) {
                toast({ title: "Coupon created" });
                setCoupons((c) => [r.data as Coupon, ...c]);
                (e.target as HTMLFormElement).reset();
              } else toast({ title: "Error", description: r.error, variant: "destructive" });
            });
          }}
          className="grid gap-3 sm:grid-cols-2"
        >
          <Input name="code" placeholder="CODE" required />
          <select name="type" className="h-10 rounded-md border border-input bg-background/50 px-3 text-sm">
            <option value="PERCENT">Percent</option>
            <option value="FIXED">Fixed (cents)</option>
          </select>
          <Input name="value" type="number" placeholder="Value" required />
          <Input name="maxUses" type="number" placeholder="Max uses" />
          <select name="appliesTo" className="h-10 rounded-md border border-input bg-background/50 px-3 text-sm">
            <option value="all">All</option>
            <option value="subscription">Subscription</option>
            <option value="product">Product</option>
          </select>
          <Button type="submit" variant="neon" disabled={pending}>Create</Button>
        </form>
      </Card>

      <div className="space-y-2">
        {coupons.map((c) => (
          <Card key={c.id} className="glass p-4 flex justify-between items-center">
            <div>
              <p className="font-mono font-bold">{c.code}</p>
              <p className="text-xs text-muted-foreground">
                {c.type} {c.value} · {c.usedCount}/{c.maxUses ?? "∞"} uses · {c.appliesTo}
              </p>
            </div>
            <div className="flex gap-2">
              <Badge variant={c.isActive ? "free" : "destructive"}>{c.isActive ? "Active" : "Off"}</Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  startTransition(async () => {
                    await toggleCoupon(c.id, !c.isActive);
                    setCoupons((list) =>
                      list.map((x) => (x.id === c.id ? { ...x, isActive: !c.isActive } : x))
                    );
                  })
                }
              >
                Toggle
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() =>
                  startTransition(async () => {
                    const r = await deleteCoupon(c.id);
                    if (r.success) setCoupons((list) => list.filter((x) => x.id !== c.id));
                  })
                }
              >
                Delete
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
