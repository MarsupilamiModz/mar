"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { createLicense } from "@/actions/admin/licenses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useAppToast } from "@/hooks/use-app-toast";

export default function CreatorLicensesPage() {
  const t = useTranslations("ecosystem");
  const appToast = useAppToast();
  const [pending, startTransition] = useTransition();
  const [generatedKey, setGeneratedKey] = useState("");

  return (
    <div className="max-w-lg space-y-6">
      <h2 className="text-lg font-semibold">{t("licenses")}</h2>
      <Card className="glass p-6 space-y-4">
        <p className="text-sm text-muted-foreground">{t("createLicenseHint")}</p>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(async () => {
              const r = await createLicense({
                productType: "mod",
                modId: fd.get("modId") as string,
                label: fd.get("label") as string,
                maxActivations: Number(fd.get("maxActivations") || 1),
                expiresAt: (fd.get("expiresAt") as string) || undefined,
              });
              if (r.success && r.data?.key) {
                setGeneratedKey(r.data.key);
                appToast.created();
              } else if (!r.success) appToast.error(r.error);
            });
          }}
        >
          <Input name="modId" placeholder={t("modIdPlaceholder")} required />
          <Input name="label" placeholder={t("labelPlaceholder")} />
          <Input name="maxActivations" type="number" defaultValue={1} min={1} max={100} />
          <Input name="expiresAt" type="datetime-local" />
          <Button type="submit" variant="neon" disabled={pending}>{t("generateKey")}</Button>
        </form>
        {generatedKey && (
          <div className="p-3 rounded-lg bg-muted/30 font-mono text-sm break-all">{generatedKey}</div>
        )}
      </Card>
    </div>
  );
}
