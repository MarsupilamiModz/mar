"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

export default function AdminLicensesPage() {
  const [keys, setKeys] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <h1 className="text-2xl font-bold">License Keys</h1>
      <Card className="glass p-6 mt-8 max-w-lg">
        <h3 className="font-medium mb-4">Bulk generate</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(async () => {
              const res = await fetch("/api/admin/licenses/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  count: Number(fd.get("count")),
                  productType: fd.get("productType"),
                }),
              });
              const data = await res.json();
              if (data.success && data.data?.keys) {
                setKeys(data.data.keys);
                toast({ title: `${data.data.keys.length} keys generated` });
              } else {
                toast({ title: "Error", description: data.error, variant: "destructive" });
              }
            });
          }}
          className="space-y-3"
        >
          <Input name="count" type="number" defaultValue={10} min={1} max={100} required />
          <Input name="productType" defaultValue="premium" required />
          <Button type="submit" variant="neon" disabled={pending}>Generate</Button>
        </form>
        {keys.length > 0 && (
          <div className="mt-6 max-h-64 overflow-y-auto space-y-1 font-mono text-xs">
            {keys.map((k) => (
              <p key={k} className="p-2 bg-muted/30 rounded">{k}</p>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
