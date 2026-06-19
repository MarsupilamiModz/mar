"use client";

import { useState, useTransition } from "react";
import { submitDMCAClaim } from "@/actions/admin/trust";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

export function DMCAPortalForm() {
  const [pending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await submitDMCAClaim({
        companyName: fd.get("companyName") as string,
        legalName: fd.get("legalName") as string,
        contactEmail: fd.get("contactEmail") as string,
        contactPhone: (fd.get("contactPhone") as string) || undefined,
        infringingUrl: fd.get("infringingUrl") as string,
        description: fd.get("description") as string,
      });
      if (r.success) {
        setSubmitted(true);
        toast({ title: "DMCA notice submitted" });
      } else toast({ title: "Error", description: r.error, variant: "destructive" });
    });
  }

  if (submitted) {
    return (
      <Card className="glass p-8 text-center">
        <h2 className="text-xl font-semibold text-emerald-400">Notice received</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Our legal team will review your submission and respond via email.
        </p>
      </Card>
    );
  }

  return (
    <Card className="glass p-8">
      <form onSubmit={submit} className="space-y-4 max-w-xl">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm">Company / Organization</label>
            <Input name="companyName" required className="mt-1" />
          </div>
          <div>
            <label className="text-sm">Legal name</label>
            <Input name="legalName" required className="mt-1" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm">Contact email</label>
            <Input name="contactEmail" type="email" required className="mt-1" />
          </div>
          <div>
            <label className="text-sm">Phone (optional)</label>
            <Input name="contactPhone" className="mt-1" />
          </div>
        </div>
        <div>
          <label className="text-sm">Infringing URL</label>
          <Input name="infringingUrl" type="url" required placeholder="https://…" className="mt-1" />
        </div>
        <div>
          <label className="text-sm">Description & proof of ownership</label>
          <Textarea name="description" required rows={6} className="mt-1" placeholder="Describe the copyrighted work and how the listed URL infringes…" />
        </div>
        <Button type="submit" variant="neon" disabled={pending}>
          Submit DMCA notice
        </Button>
      </form>
    </Card>
  );
}
