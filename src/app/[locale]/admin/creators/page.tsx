import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { listCreators } from "@/actions/admin/creators";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreatorLevelBadge } from "@/components/creator/creator-level-badge";
import type { Locale } from "@/i18n/config";

export default async function AdminCreatorsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;

  setRequestLocale(locale);
  const t = await getTranslations("ecosystem");
  const result = await listCreators();
  const creators = result.success ? result.data.creators : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t("creatorManagement")}</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/${locale}/admin/creators/visibility`}>{t("visibleCreators")}</Link>
          </Button>
          <Button variant="neon" size="sm" asChild>
            <Link href={`/${locale}/admin/creators/new`}>{t("createCreator")}</Link>
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        {creators.length === 0 ? (
          <Card className="glass p-8 text-center text-muted-foreground">{t("noCreators")}</Card>
        ) : (
          creators.map((c) => (
            <Card key={c.id} className="glass p-4 flex flex-wrap justify-between items-center gap-3 hover:border-neon-purple/30 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <CreatorLevelBadge level={c.level} size="xs" />
                <div>
                  <p className="font-medium">{c.user.displayName ?? c.user.username}</p>
                  <p className="text-xs text-muted-foreground">/{c.slug} · {c.creatorCode ?? "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!c.isPublic && <span className="text-xs text-muted-foreground">{t("hidden")}</span>}
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/${locale}/admin/creators/${c.id}`}>{t("manage")}</Link>
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
