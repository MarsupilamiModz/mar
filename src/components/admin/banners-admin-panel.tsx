"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createSiteBanner,
  deleteSiteBanner,
  toggleSiteBanner,
} from "@/actions/admin/banners";
import type { getAdminSiteBanners } from "@/actions/admin/banners";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAppToast } from "@/hooks/use-app-toast";
import { SiteBannerFrequency, SiteBannerType } from "@prisma/client";

type BannerRow = Extract<
  Awaited<ReturnType<typeof getAdminSiteBanners>>,
  { success: true }
>["data"][number];

const TYPES: SiteBannerType[] = ["GLOBAL", "GAME", "CATEGORY", "MOD", "PARTNER"];
const FREQUENCIES: SiteBannerFrequency[] = [
  "ALWAYS",
  "EVERY_5_MIN",
  "EVERY_15_MIN",
  "ONCE_SESSION",
  "ONCE_DAY",
];

export function BannersAdminPanel({ banners }: { banners: BannerRow[] }) {
  const router = useRouter();
  const appToast = useAppToast();
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-6">
      <Card className="glass p-6 space-y-4">
        <h3 className="font-semibold">Create banner</h3>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(async () => {
              const r = await createSiteBanner({
                type: fd.get("type") as SiteBannerType,
                title: fd.get("title") as string,
                description: (fd.get("description") as string) || undefined,
                imageUrl: (fd.get("imageUrl") as string) || undefined,
                linkUrl: (fd.get("linkUrl") as string) || undefined,
                buttonText: (fd.get("buttonText") as string) || undefined,
                frequency: fd.get("frequency") as SiteBannerFrequency,
                priority: Number(fd.get("priority") || 0),
                gameId: (fd.get("gameId") as string) || null,
                gameCategoryId: (fd.get("gameCategoryId") as string) || null,
              });
              if (r.success) {
                appToast.saved();
                router.refresh();
                e.currentTarget.reset();
              } else appToast.error(r.error);
            });
          }}
        >
          <select name="type" defaultValue="GLOBAL" className="h-10 rounded-md border border-input bg-background/50 px-3 text-sm">
            {TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select name="frequency" defaultValue="ALWAYS" className="h-10 rounded-md border border-input bg-background/50 px-3 text-sm">
            {FREQUENCIES.map((f) => (
              <option key={f} value={f}>{f.replace(/_/g, " ")}</option>
            ))}
          </select>
          <Input name="title" placeholder="Title" required className="sm:col-span-2" />
          <Input name="description" placeholder="Description" className="sm:col-span-2" />
          <Input name="imageUrl" placeholder="Image URL" />
          <Input name="linkUrl" placeholder="Link URL" />
          <Input name="buttonText" placeholder="Button text" />
          <Input name="priority" type="number" defaultValue={0} placeholder="Priority" />
          <Input name="gameId" placeholder="Game ID (GAME type)" />
          <Input name="gameCategoryId" placeholder="Category ID (CATEGORY type)" />
          <Button type="submit" variant="neon" disabled={pending} className="sm:col-span-2">
            Create banner
          </Button>
        </form>
      </Card>

      <Card className="glass p-6">
        <h3 className="font-semibold mb-4">Active banners</h3>
        <div className="space-y-3">
          {banners.map((banner) => (
            <div key={banner.id} className="rounded-lg border border-border/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{banner.title}</p>
                  <p className="text-xs text-muted-foreground">{banner.type} · {banner.frequency}</p>
                </div>
                <Badge variant={banner.isActive ? "premium" : "outline"}>
                  {banner.isActive ? "Active" : "Off"}
                </Badge>
              </div>
              {banner.description && (
                <p className="text-sm text-muted-foreground mt-2">{banner.description}</p>
              )}
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const r = await toggleSiteBanner(banner.id, !banner.isActive);
                      if (r.success) router.refresh();
                    })
                  }
                >
                  {banner.isActive ? "Disable" : "Enable"}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={pending}
                  onClick={() => {
                    if (!confirm("Delete this banner?")) return;
                    startTransition(async () => {
                      const r = await deleteSiteBanner(banner.id);
                      if (r.success) router.refresh();
                    });
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
          {banners.length === 0 && (
            <p className="text-sm text-muted-foreground">No banners configured.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
