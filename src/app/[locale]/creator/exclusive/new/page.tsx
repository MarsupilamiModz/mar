import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { getCreatorModsForExclusive } from "@/actions/exclusive";
import { ExclusiveProgramForm } from "@/components/exclusive/exclusive-program-form";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";

export default async function CreatorExclusiveNewPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;

  await requireAuth(`/${locale}/creator/exclusive/new`);
  const result = await getCreatorModsForExclusive();
  const mods = result.success ? result.data : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Launch exclusive program</h2>
          <p className="text-sm text-muted-foreground">Closed alpha, beta, or invite-only release.</p>
        </div>
        <Button variant="outline" asChild>
          <Link href={`/${locale}/creator/exclusive`}>Back</Link>
        </Button>
      </div>
      <ExclusiveProgramForm locale={locale} mods={mods} />
    </div>
  );
}
