"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { submitPartnerApplication } from "@/actions/applications";

export function PartnerApplicationForm({
  userEmail,
  username,
}: {
  userEmail: string;
  username: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Card className="glass max-w-2xl">
      <CardHeader>
        <CardTitle>Become a Partner</CardTitle>
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
            const platforms = (fd.get("platforms") as string)
              .split(",")
              .map((p) => p.trim())
              .filter(Boolean);
            startTransition(async () => {
              const r = await submitPartnerApplication({
                creatorName: fd.get("creatorName") as string,
                username: fd.get("username") as string,
                email: fd.get("email") as string,
                discord: (fd.get("discord") as string) || undefined,
                youtubeUrl: (fd.get("youtube") as string) || undefined,
                twitchUrl: (fd.get("twitch") as string) || undefined,
                tiktokUrl: (fd.get("tiktok") as string) || undefined,
                instagramUrl: (fd.get("instagram") as string) || undefined,
                xUrl: (fd.get("x") as string) || undefined,
                websiteUrl: (fd.get("website") as string) || undefined,
                audienceSize: (fd.get("audienceSize") as string) || undefined,
                platforms,
                whyPartner: (fd.get("whyPartner") as string) || undefined,
                promotionStrategy: (fd.get("promotionStrategy") as string) || undefined,
              });
              if (r.success) {
                toast({ title: "Application submitted — pending admin review" });
                router.refresh();
              } else toast({ title: r.error, variant: "destructive" });
            });
          }}
        >
          <Input name="creatorName" placeholder="Name / brand name" required />
          <Input name="username" defaultValue={username} placeholder="Username" required />
          <Input name="email" type="email" defaultValue={userEmail} required />
          <Input name="discord" placeholder="Discord username" />
          <Input name="audienceSize" placeholder="Audience size (e.g. 50k)" />
          <Input name="platforms" placeholder="Platforms (comma-separated)" />
          <div className="grid sm:grid-cols-2 gap-3">
            <Input name="youtube" placeholder="YouTube URL" />
            <Input name="twitch" placeholder="Twitch URL" />
            <Input name="tiktok" placeholder="TikTok URL" />
            <Input name="instagram" placeholder="Instagram URL" />
            <Input name="x" placeholder="X / Twitter URL" />
            <Input name="website" placeholder="Website URL" />
          </div>
          <Textarea name="whyPartner" placeholder="Why do you want to partner with us?" rows={3} required />
          <Textarea name="promotionStrategy" placeholder="Promotion strategy" rows={3} />
          <Button type="submit" variant="neon" disabled={pending}>
            Submit application
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
