"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { createCustomOrderFromForm } from "@/actions/orders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

export default function CustomOrdersPage() {
  const params = useParams();
  const locale = params.locale as string;
  const router = useRouter();
  const t = useTranslations("orders");
  const [submitted, setSubmitted] = useState(false);
  const [pending, startTransition] = useTransition();

  const orderTypes = [
    "redux_minimap",
    "custom_hud",
    "ui_package",
    "commission",
  ] as const;

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-gradient">{t("title")}</h1>
      <p className="mt-3 text-muted-foreground leading-relaxed">{t("subtitle")}</p>
      <p className="mt-3 text-sm text-muted-foreground">
        <Link href={`/${locale}/login`} className="text-neon-purple hover:underline">
          {t("signInHint")}
        </Link>
      </p>
      <Card className="glass mt-8 p-6 sm:p-8">
        {submitted ? (
          <p className="text-neon-blue">
            {t("submitted")}{" "}
            <Link href={`/${locale}/dashboard/orders`} className="underline">
              →
            </Link>
          </p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              startTransition(async () => {
                const res = await createCustomOrderFromForm(form);
                if (res.success) {
                  setSubmitted(true);
                  toast({ title: t("submitted") });
                  router.push(`/${locale}/dashboard/orders/${res.data.id}`);
                } else {
                  toast({
                    title: res.error === "Unauthorized" ? t("signInHint") : "Error",
                    description: res.error,
                    variant: "destructive",
                  });
                }
              });
            }}
            className="space-y-4"
          >
            <Input name="title" placeholder="Project title" required minLength={5} />
            <select
              name="orderType"
              className="flex h-10 w-full rounded-md border border-input bg-background/50 px-3 text-sm"
              required
            >
              {orderTypes.map((type) => (
                <option key={type} value={type}>
                  {t(`types.${type}`)}
                </option>
              ))}
            </select>
            <textarea
              name="description"
              className="flex min-h-[140px] w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm"
              placeholder="Describe scope, references, and timeline…"
              required
              minLength={20}
            />
            <Input name="budget" type="number" placeholder="Budget (Credits, optional)" min={0} step={100} />
            <Input name="discord" placeholder="Discord username (optional)" />
            <div className="space-y-2">
              <label className="text-sm font-medium">Reference files (optional, max 5)</label>
              <Input
                name="references"
                type="file"
                multiple
                accept="image/*,.pdf,.zip,.rar,.7z,.psd,.png,.jpg,.jpeg,.webp"
              />
              <p className="text-xs text-muted-foreground">Upload mockups, inspiration, or existing assets (15MB each).</p>
            </div>
            <Button variant="neon" type="submit" className="w-full" disabled={pending}>
              {t("submit")}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
