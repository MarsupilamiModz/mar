"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createCreatorProfile, searchUsersForCreator } from "@/actions/admin/creators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LEVEL_OPTIONS, CREATOR_LEVELS } from "@/lib/creator-levels";
import type { PublisherLevel } from "@prisma/client";
import { useAppToast } from "@/hooks/use-app-toast";

export default function NewCreatorForm({ locale }: { locale: string }) {
  const t = useTranslations("ecosystem");
  const appToast = useAppToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [userId, setUserId] = useState("");
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<{ id: string; username: string; email: string }[]>([]);
  const [level, setLevel] = useState<PublisherLevel>("VERIFIED");

  return (
    <Card className="glass p-6 max-w-lg space-y-4">
      <div className="flex gap-2">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchUser")} />
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            startTransition(async () => {
              const r = await searchUsersForCreator(search);
              if (r.success) setUsers(r.data);
            })
          }
        >
          {t("search")}
        </Button>
      </div>
      {users.length > 0 && (
        <Select value={userId} onValueChange={setUserId}>
          <SelectTrigger><SelectValue placeholder={t("selectUser")} /></SelectTrigger>
          <SelectContent>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>@{u.username} · {u.email}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Select value={level} onValueChange={(v) => setLevel(v as PublisherLevel)}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {LEVEL_OPTIONS.map((l) => (
            <SelectItem key={l} value={l}>{t(CREATOR_LEVELS[l].labelKey)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!userId) return;
          const fd = new FormData(e.currentTarget);
          startTransition(async () => {
            const r = await createCreatorProfile({
              userId,
              level: level as "VERIFIED" | "TRUSTED" | "ELITE" | "OFFICIAL_PARTNER",
              tagline: fd.get("tagline") as string,
              description: fd.get("description") as string,
              isPublic: fd.get("isPublic") === "on",
              isFeatured: fd.get("isFeatured") === "on",
            });
            if (r.success) {
              appToast.created();
              router.push(`/${locale}/admin/creators/${r.data.id}`);
            } else appToast.error(r.error);
          });
        }}
      >
        <Input name="tagline" placeholder={t("tagline")} />
        <Textarea name="description" placeholder={t("bio")} rows={3} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isPublic" />{t("public")}</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isFeatured" />{t("featured")}</label>
        <Button type="submit" variant="neon" disabled={pending || !userId}>{t("createCreator")}</Button>
      </form>
    </Card>
  );
}
