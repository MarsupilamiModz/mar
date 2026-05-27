"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { createMod } from "@/actions/mods";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { useAppToast } from "@/hooks/use-app-toast";
import { formatCategoryOptions, type FlatCategory } from "@/lib/categories";

type Game = { id: string; name: string };
type Category = FlatCategory & { gameId: string };

export function ModForm({
  locale,
  games,
  categories,
}: {
  locale: string;
  games: Game[];
  categories: Category[];
}) {
  const t = useTranslations("creator");
  const tm = useTranslations("mods");
  const tc = useTranslations("common");
  const appToast = useAppToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [gameId, setGameId] = useState(games[0]?.id ?? "");
  const [pricing, setPricing] = useState<"FREE" | "PREMIUM" | "PAID">("FREE");

  const gameCategories = formatCategoryOptions(categories.filter((c) => c.gameId === gameId));

  return (
    <Card className="glass p-6 max-w-2xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const tags = (fd.get("tags") as string)
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean);

          startTransition(async () => {
            const r = await createMod({
              title: fd.get("title") as string,
              description: fd.get("description") as string,
              shortDescription: (fd.get("shortDescription") as string) || undefined,
              gameId,
              categoryId: (fd.get("categoryId") as string) || undefined,
              pricing,
              priceCents: pricing === "PAID" ? Number(fd.get("priceCents")) * 100 : undefined,
              tags,
            });
            if (r.success) {
              appToast.created();
              router.push(`/${locale}/creator/mods/${r.data.id}`);
              router.refresh();
            } else appToast.error(r.error);
          });
        }}
        className="space-y-4"
      >
        <div>
          <label className="text-sm font-medium">{t("newMod")}</label>
          <Input name="title" required minLength={3} className="mt-1" />
        </div>
        <div>
          <label className="text-sm font-medium">{tm("search")}</label>
          <Input name="shortDescription" maxLength={300} className="mt-1" />
        </div>
        <div>
          <label className="text-sm font-medium">{t("manageMod")}</label>
          <Textarea name="description" required minLength={20} rows={6} className="mt-1" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium">{t("myMods")}</label>
            <Select value={gameId} onValueChange={setGameId}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {games.map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">{t("manageMod")}</label>
            <select name="categoryId" className="mt-1 flex h-10 w-full rounded-md border border-input bg-background/50 px-3 text-sm">
              <option value="">—</option>
              {gameCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium">{tm("filter")}</label>
          <Select value={pricing} onValueChange={(v) => setPricing(v as typeof pricing)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="FREE">{tm("free")}</SelectItem>
              <SelectItem value="PREMIUM">{tm("premium")}</SelectItem>
              <SelectItem value="PAID">{tm("paid")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {pricing === "PAID" && (
          <div>
            <label className="text-sm font-medium">{tm("paid")}</label>
            <Input name="priceCents" type="number" min={0} step={0.01} className="mt-1" />
          </div>
        )}
        <div>
          <label className="text-sm font-medium">Tags</label>
          <Input name="tags" placeholder="ui, hud, realism" className="mt-1" />
        </div>
        <Button type="submit" variant="neon" disabled={pending}>
          {pending ? tc("loading") : t("createMod")}
        </Button>
      </form>
    </Card>
  );
}
