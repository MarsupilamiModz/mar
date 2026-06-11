"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { submitPartnerApplication } from "@/actions/applications";
import type { PartnerFormField } from "@/lib/partner-form-config";

const KNOWN_MAPS = new Set([
  "creatorName",
  "username",
  "email",
  "discord",
  "youtubeUrl",
  "twitchUrl",
  "tiktokUrl",
  "instagramUrl",
  "xUrl",
  "websiteUrl",
  "audienceSize",
  "country",
  "whyPartner",
  "message",
  "promotionStrategy",
]);

export function PartnerApplicationForm({
  fields,
  userEmail,
  username,
  applicationId,
}: {
  fields: PartnerFormField[];
  userEmail: string;
  username: string;
  applicationId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const defaults = { username, email: userEmail };

  return (
    <Card className="glass max-w-2xl">
      <CardHeader>
        <CardTitle>{applicationId ? "Update your application" : "Become a Partner"}</CardTitle>
        <p className="text-sm text-muted-foreground">
          Submit your application for admin review. Partner profiles are created only after approval.
        </p>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const payload: Record<string, unknown> = { applicationId };
            const customResponses: Record<string, string | boolean> = {};

            for (const field of fields) {
              const raw = fd.get(field.id);
              if (field.type === "checkbox") {
                const checked = raw === "on";
                if (field.mapsTo && KNOWN_MAPS.has(field.mapsTo)) {
                  payload[field.mapsTo] = checked;
                } else {
                  customResponses[field.id] = checked;
                }
                continue;
              }
              const value = typeof raw === "string" ? raw.trim() : "";
              if (field.mapsTo && KNOWN_MAPS.has(field.mapsTo)) {
                payload[field.mapsTo] = value || undefined;
              } else if (value) {
                customResponses[field.id] = value;
              }
            }

            startTransition(async () => {
              const r = await submitPartnerApplication({
                applicationId,
                creatorName: (payload.creatorName as string) ?? "",
                username: (payload.username as string) ?? username,
                email: (payload.email as string) ?? userEmail,
                discord: payload.discord as string | undefined,
                youtubeUrl: payload.youtubeUrl as string | undefined,
                twitchUrl: payload.twitchUrl as string | undefined,
                tiktokUrl: payload.tiktokUrl as string | undefined,
                instagramUrl: payload.instagramUrl as string | undefined,
                xUrl: payload.xUrl as string | undefined,
                websiteUrl: payload.websiteUrl as string | undefined,
                audienceSize: payload.audienceSize as string | undefined,
                country: payload.country as string | undefined,
                whyPartner: payload.whyPartner as string | undefined,
                promotionStrategy: payload.promotionStrategy as string | undefined,
                message: payload.message as string | undefined,
                customResponses,
              });
              if (r.success) {
                toast({ title: applicationId ? "Application updated" : "Application submitted — pending admin review" });
                router.refresh();
              } else toast({ title: r.error, variant: "destructive" });
            });
          }}
        >
          {fields.map((field) => {
            const defaultValue = field.mapsTo
              ? defaults[field.mapsTo as keyof typeof defaults]
              : undefined;

            if (field.type === "textarea") {
              return (
                <Textarea
                  key={field.id}
                  name={field.id}
                  placeholder={field.placeholder ?? field.label}
                  rows={3}
                  required={field.required}
                />
              );
            }

            if (field.type === "select") {
              return (
                <select
                  key={field.id}
                  name={field.id}
                  required={field.required}
                  className="h-10 w-full rounded-md border border-input bg-background/50 px-3 text-sm"
                  defaultValue=""
                >
                  <option value="" disabled>{field.placeholder ?? field.label}</option>
                  {(field.options ?? []).map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              );
            }

            if (field.type === "checkbox") {
              return (
                <label key={field.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name={field.id} required={field.required} className="rounded border-input" />
                  {field.label}
                </label>
              );
            }

            return (
              <Input
                key={field.id}
                name={field.id}
                type={field.type === "email" ? "email" : field.type === "url" ? "url" : "text"}
                placeholder={field.placeholder ?? field.label}
                defaultValue={defaultValue}
                required={field.required}
              />
            );
          })}
          <Button type="submit" variant="neon" disabled={pending}>
            {applicationId ? "Resubmit application" : "Submit application"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
