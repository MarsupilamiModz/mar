"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PublisherLevel } from "@prisma/client";
import {
  updatePartnerProfile,
  setPartnerLevel,
  assignPartnerCode,
  deletePartnerProfile,
} from "@/actions/admin/partners";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LEVEL_OPTIONS } from "@/lib/creator-levels";
import { formatCents } from "@/lib/affiliate";
import { useAppToast } from "@/hooks/use-app-toast";

type PartnerData = {
  id: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  website: string | null;
  affiliateCode: string | null;
  level: PublisherLevel;
  commissionRateBps: number;
  isVerified: boolean;
  isFeatured: boolean;
  isSuspended: boolean;
  isBanned: boolean;
  totalClicks: number;
  totalConversions: number;
  totalRevenueCents: number;
  discordInviteUrl?: string | null;
  discordWidgetUrl?: string | null;
  discordServerId?: string | null;
  discordWidgetEnabled?: boolean;
  discordDescription?: string | null;
  user: { id: string; username: string; displayName: string | null; email: string };
};

export function PartnerAdminPanel({ locale, partner }: { locale: string; partner: PartnerData }) {
  const router = useRouter();
  const appToast = useAppToast();
  const [pending, startTransition] = useTransition();
  const [code, setCode] = useState(partner.affiliateCode ?? "");

  const save = (formData: FormData) => {
    startTransition(async () => {
      const r = await updatePartnerProfile(partner.id, {
        userId: partner.user.id,
        tagline: (formData.get("tagline") as string) || undefined,
        description: (formData.get("description") as string) || undefined,
        website: (formData.get("website") as string) || undefined,
        commissionRateBps: Number(formData.get("commissionRateBps")),
        isVerified: formData.get("isVerified") === "on",
        isFeatured: formData.get("isFeatured") === "on",
        isSuspended: formData.get("isSuspended") === "on",
        discordInviteUrl: (formData.get("discordInviteUrl") as string) || null,
        discordWidgetUrl: (formData.get("discordWidgetUrl") as string) || null,
        discordServerId: (formData.get("discordServerId") as string) || null,
        discordWidgetEnabled: formData.get("discordWidgetEnabled") === "on",
        discordDescription: (formData.get("discordDescription") as string) || null,
      });
      if (r.success) { appToast.saved(); router.refresh(); }
      else appToast.error(r.error);
    });
  };

  return (
    <div className="space-y-6">
      <Card className="glass p-6 space-y-4">
        <div className="flex flex-wrap gap-2">
          {partner.isVerified && <Badge variant="premium">Verified</Badge>}
          {partner.isFeatured && <Badge variant="outline">Featured</Badge>}
          {partner.isSuspended && <Badge variant="destructive">Suspended</Badge>}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            save(new FormData(e.currentTarget));
          }}
          className="space-y-3"
        >
          <Input name="tagline" defaultValue={partner.tagline ?? ""} placeholder="Tagline" />
          <Textarea name="description" defaultValue={partner.description ?? ""} rows={4} placeholder="Bio" />
          <Input name="website" defaultValue={partner.website ?? ""} placeholder="Website URL" />
          <Input name="commissionRateBps" type="number" defaultValue={partner.commissionRateBps} placeholder="Commission bps" />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isVerified" defaultChecked={partner.isVerified} /> Verified</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isFeatured" defaultChecked={partner.isFeatured} /> Featured</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isSuspended" defaultChecked={partner.isSuspended} /> Suspended</label>
          <Button type="submit" variant="neon" disabled={pending}>Save partner</Button>
        </form>
      </Card>

      <Card className="glass p-6 space-y-4">
        <h3 className="font-semibold">Discord community</h3>
        <p className="text-xs text-muted-foreground">
          Invite link, server ID, and widget are validated on save. Enable the widget in Discord Server Settings → Widget.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save(new FormData(e.currentTarget));
          }}
          className="space-y-3"
        >
          <Input name="discordInviteUrl" defaultValue={partner.discordInviteUrl ?? ""} placeholder="Discord invite URL (https://discord.gg/…)" />
          <Input name="discordServerId" defaultValue={partner.discordServerId ?? ""} placeholder="Discord Server ID (17–20 digits)" className="font-mono text-xs" />
          <Input name="discordWidgetUrl" defaultValue={partner.discordWidgetUrl ?? ""} placeholder="Custom widget URL (optional — auto-generated from server ID)" className="font-mono text-xs" />
          <Textarea name="discordDescription" defaultValue={partner.discordDescription ?? ""} rows={3} placeholder="Community description shown on partner page" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="discordWidgetEnabled" defaultChecked={partner.discordWidgetEnabled !== false} />
            Show Discord widget on partner page
          </label>
          <Button type="submit" variant="outline" disabled={pending}>Save Discord settings</Button>
        </form>
      </Card>

      <Card className="glass p-6 space-y-4">
        <h3 className="font-semibold">Level & codes</h3>
        <Select
          defaultValue={partner.level}
          onValueChange={(v) => startTransition(async () => {
            const r = await setPartnerLevel(partner.id, v as PublisherLevel);
            if (r.success) { appToast.saved(); router.refresh(); }
          })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {LEVEL_OPTIONS.map((l) => (
              <SelectItem key={l} value={l}>{l.replace("_", " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Affiliate code" className="font-mono" />
          <Button variant="outline" disabled={pending} onClick={() => startTransition(async () => {
            const r = await assignPartnerCode(partner.id, code);
            if (r.success) { appToast.saved(); router.refresh(); }
            else appToast.error(r.error);
          })}>Assign code</Button>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center text-sm">
          <div><p className="text-2xl font-bold">{partner.totalClicks}</p><p className="text-muted-foreground">Clicks</p></div>
          <div><p className="text-2xl font-bold">{partner.totalConversions}</p><p className="text-muted-foreground">Conversions</p></div>
          <div><p className="text-2xl font-bold">{formatCents(partner.totalRevenueCents)}</p><p className="text-muted-foreground">Revenue</p></div>
        </div>
        <Button
          variant="destructive"
          disabled={pending}
          onClick={() => {
            if (!confirm("Delete this partner profile?")) return;
            startTransition(async () => {
              const r = await deletePartnerProfile(partner.id);
              if (r.success) router.push(`/${locale}/admin/partners`);
              else appToast.error(r.error);
            });
          }}
        >
          Delete partner
        </Button>
      </Card>
    </div>
  );
}
