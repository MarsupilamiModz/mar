"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { submitPartnerApplication } from "@/actions/applications";

export function PartnerApplicationForm({ userEmail }: { userEmail: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Card className="glass max-w-2xl">
      <CardHeader>
        <CardTitle>Become a Partner</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const platforms = (fd.get("platforms") as string)
              .split(",")
              .map((p) => p.trim())
              .filter(Boolean);
            startTransition(async () => {
              const r = await submitPartnerApplication({
                creatorName: fd.get("creatorName") as string,
                email: fd.get("email") as string,
                audienceSize: (fd.get("audienceSize") as string) || undefined,
                platforms,
                promotionStrategy: (fd.get("promotionStrategy") as string) || undefined,
                message: (fd.get("message") as string) || undefined,
                socialLinks: {
                  youtube: (fd.get("youtube") as string) || "",
                  twitch: (fd.get("twitch") as string) || "",
                  website: (fd.get("website") as string) || "",
                },
              });
              if (r.success) {
                toast({ title: "Application submitted" });
                router.refresh();
              } else toast({ title: r.error, variant: "destructive" });
            });
          }}
        >
          <Input name="creatorName" placeholder="Creator / brand name" required />
          <Input name="email" type="email" defaultValue={userEmail} required />
          <Input name="audienceSize" placeholder="Audience size (e.g. 50k)" />
          <Input name="platforms" placeholder="Platforms (comma-separated)" />
          <Input name="youtube" placeholder="YouTube" />
          <Input name="twitch" placeholder="Twitch" />
          <Input name="website" placeholder="Website" />
          <Textarea name="promotionStrategy" placeholder="Promotion strategy" rows={3} />
          <Textarea name="message" placeholder="Additional information" rows={3} />
          <Button type="submit" variant="neon" disabled={pending}>
            Submit application
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
