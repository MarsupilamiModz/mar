"use client";

import { memo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { savePartnerFormFieldsAdmin } from "@/actions/admin/applications";
import type { PartnerFormField, PartnerFormFieldType } from "@/lib/partner-form-config";

const FIELD_TYPES: PartnerFormFieldType[] = ["text", "email", "url", "textarea", "select", "checkbox"];

function PartnerFormBuilderInner({ initialFields }: { initialFields: PartnerFormField[] }) {
  const router = useRouter();
  const [fields, setFields] = useState(initialFields);
  const [pending, startTransition] = useTransition();

  function updateField(id: string, patch: Partial<PartnerFormField>) {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function addField() {
    const id = `field_${Date.now()}`;
    setFields((prev) => [
      ...prev,
      {
        id,
        type: "text",
        label: "New field",
        required: false,
        sortOrder: prev.length,
      },
    ]);
  }

  function removeField(id: string) {
    setFields((prev) => prev.filter((f) => f.id !== id).map((f, i) => ({ ...f, sortOrder: i })));
  }

  function moveField(id: string, dir: -1 | 1) {
    setFields((prev) => {
      const idx = prev.findIndex((f) => f.id === id);
      if (idx < 0) return prev;
      const next = idx + dir;
      if (next < 0 || next >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(idx, 1);
      copy.splice(next, 0, item!);
      return copy.map((f, i) => ({ ...f, sortOrder: i }));
    });
  }

  function save() {
    startTransition(async () => {
      const r = await savePartnerFormFieldsAdmin(fields);
      if (r.success) {
        toast({ title: "Form saved" });
        router.refresh();
      } else toast({ title: r.error, variant: "destructive" });
    });
  }

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle>Partner application form builder</CardTitle>
        <p className="text-sm text-muted-foreground">
          Configure fields, requirements, dropdowns, and order for the public partner application form.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {fields.map((field) => (
          <div key={field.id} className="grid gap-2 border border-border/30 rounded-lg p-3 sm:grid-cols-2">
            <Input value={field.label} onChange={(e) => updateField(field.id, { label: e.target.value })} placeholder="Label" />
            <Input value={field.id} onChange={(e) => updateField(field.id, { id: e.target.value })} placeholder="Field ID" />
            <Input value={field.placeholder ?? ""} onChange={(e) => updateField(field.id, { placeholder: e.target.value })} placeholder="Placeholder" />
            <select
              className="h-10 rounded-md border border-input bg-background/50 px-3 text-sm"
              value={field.type}
              onChange={(e) => updateField(field.id, { type: e.target.value as PartnerFormFieldType })}
            >
              {FIELD_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            {field.type === "select" && (
              <Input
                className="sm:col-span-2"
                value={(field.options ?? []).join(", ")}
                onChange={(e) =>
                  updateField(field.id, {
                    options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                  })
                }
                placeholder="Dropdown options (comma-separated)"
              />
            )}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={field.required}
                onChange={(e) => updateField(field.id, { required: e.target.checked })}
              />
              Required
            </label>
            <div className="flex gap-1 sm:col-span-2">
              <Button type="button" size="sm" variant="outline" onClick={() => moveField(field.id, -1)}>↑</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => moveField(field.id, 1)}>↓</Button>
              <Button type="button" size="sm" variant="destructive" onClick={() => removeField(field.id)}>Remove</Button>
            </div>
          </div>
        ))}
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={addField}>Add field</Button>
          <Button type="button" variant="neon" disabled={pending} onClick={save}>Save form</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export const PartnerFormBuilder = memo(PartnerFormBuilderInner);
