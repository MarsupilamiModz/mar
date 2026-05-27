"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createPartnerProfile, searchUsersForPartner } from "@/actions/admin/partners";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDisplayName } from "@/lib/display-name";
import { useAppToast } from "@/hooks/use-app-toast";

export default function NewPartnerForm({ locale }: { locale: string }) {
  const t = useTranslations("ecosystem");
  const appToast = useAppToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [userId, setUserId] = useState("");
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<{ id: string; username: string; email: string; displayName: string | null }[]>([]);

  return (
    <Card className="glass p-6 max-w-lg space-y-4">
      <div className="flex gap-2">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchUser")} />
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            startTransition(async () => {
              const r = await searchUsersForPartner(search);
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
              <SelectItem key={u.id} value={u.id}>
                {formatDisplayName(u)} · {u.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!userId) return;
          const fd = new FormData(e.currentTarget);
          startTransition(async () => {
            const r = await createPartnerProfile({
              userId,
              tagline: fd.get("tagline") as string,
              description: fd.get("description") as string,
              website: (fd.get("website") as string) || undefined,
              isVerified: fd.get("isVerified") === "on",
              isFeatured: fd.get("isFeatured") === "on",
              isPublic: fd.get("isPublic") === "on",
            });
            if (r.success) {
              appToast.created();
              router.push(`/${locale}/admin/partners/${r.data.id}`);
            } else appToast.error(r.error);
          });
        }}
      >
        <Input name="tagline" placeholder={t("tagline")} />
        <Textarea name="description" placeholder={t("bio")} rows={3} />
        <Input name="website" placeholder="Website URL" type="url" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isPublic" defaultChecked />{t("public")}</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isVerified" />{t("verified")}</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isFeatured" />{t("featured")}</label>
        <Button type="submit" variant="neon" disabled={pending || !userId}>Create Partner</Button>
      </form>
    </Card>
  );
}
