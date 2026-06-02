"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateAdminEmailTemplate } from "@/actions/admin/email";
import type { EmailTemplate, EmailTemplateKey } from "@/lib/email/templates";
import { TEMPLATE_VARIABLES } from "@/lib/email/templates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { useAppToast } from "@/hooks/use-app-toast";

export function EmailTemplatesPanel({ templates }: { templates: EmailTemplate[] }) {
  const appToast = useAppToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Variables: {TEMPLATE_VARIABLES.join(", ")}
      </p>
      {templates.map((tpl) => (
        <Card key={tpl.key} className="glass p-6 space-y-3">
          <h3 className="font-semibold">{tpl.name}</h3>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              startTransition(async () => {
                const r = await updateAdminEmailTemplate(tpl.key as EmailTemplateKey, {
                  name: fd.get("name") as string,
                  subject: fd.get("subject") as string,
                  html: fd.get("html") as string,
                });
                if (r.success) {
                  appToast.saved();
                  router.refresh();
                } else appToast.error(r.error);
              });
            }}
          >
            <Input name="name" defaultValue={tpl.name} placeholder="Template name" />
            <Input name="subject" defaultValue={tpl.subject} placeholder="Subject" />
            <Textarea name="html" defaultValue={tpl.html} rows={6} placeholder="HTML body" className="font-mono text-xs" />
            <Button type="submit" variant="neon" size="sm" disabled={pending}>Save template</Button>
          </form>
        </Card>
      ))}
    </div>
  );
}
