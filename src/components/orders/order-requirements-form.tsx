"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitOrderRequirements } from "@/actions/orders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { useAppToast } from "@/hooks/use-app-toast";

export function OrderRequirementsForm({
  orderId,
  locale,
  productName,
}: {
  orderId: string;
  locale: string;
  productName: string;
}) {
  const appToast = useAppToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [files, setFiles] = useState<File[]>([]);

  return (
    <Card className="glass p-6 space-y-4">
      <div>
        <h2 className="text-xl font-bold">Project details</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Payment confirmed for <strong>{productName}</strong>. Tell us what you need so we can start.
        </p>
      </div>

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          files.forEach((f) => fd.append("order_files", f));

          startTransition(async () => {
            const r = await submitOrderRequirements(orderId, fd, locale);
            if (!r.success) {
              appToast.error(r.error);
              return;
            }
            appToast.saved();
            router.push(`/${locale}/dashboard/orders/${orderId}`);
            router.refresh();
          });
        }}
      >
        <div className="space-y-1">
          <label className="text-sm font-medium">Project description *</label>
          <Textarea name="projectDescription" required rows={4} placeholder="Describe your project…" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Requirements</label>
          <Textarea name="requirements" rows={4} placeholder="List specific requirements, dimensions, formats…" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Preferred style</label>
          <Input name="preferredStyle" placeholder="e.g. realistic, neon, minimal…" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium">Budget notes</label>
            <Input name="budgetNotes" placeholder="Optional budget context" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Deadline</label>
            <Input name="deadline" type="date" />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Additional notes</label>
          <Textarea name="notes" rows={2} placeholder="Anything else we should know" />
        </div>

        <div
          className="rounded-lg border border-dashed border-neon-purple/40 p-4 text-center text-sm text-muted-foreground"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            setFiles((prev) => [...prev, ...Array.from(e.dataTransfer.files)].slice(0, 10));
          }}
        >
          <p>Upload references: images, PSD, ZIP, RAR (max 10 files, 25 MB each)</p>
          <Input
            type="file"
            multiple
            accept=".png,.jpg,.jpeg,.webp,.psd,.zip,.rar,.7z,.pdf"
            className="mt-2"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 10))}
          />
          {files.length > 0 && (
            <ul className="mt-2 text-left text-xs space-y-1">
              {files.map((f) => (
                <li key={f.name}>{f.name}</li>
              ))}
            </ul>
          )}
        </div>

        <Button type="submit" variant="neon" className="w-full" disabled={pending}>
          Submit project details
        </Button>
      </form>
    </Card>
  );
}
