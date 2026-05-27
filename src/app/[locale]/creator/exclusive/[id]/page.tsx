import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { getCreatorExclusiveProgram } from "@/actions/exclusive";
import { ExclusiveProgramManager } from "@/components/exclusive/exclusive-program-manager";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";

export default async function CreatorExclusiveDetailPage({
  params: { locale, id },
}: {
  params: { locale: Locale; id: string };
}) {
  await requireAuth(`/${locale}/login`);
  const result = await getCreatorExclusiveProgram(id);
  if (!result.success) notFound();

  return (
    <div className="space-y-6">
      <Button variant="outline" size="sm" asChild>
        <Link href={`/${locale}/creator/exclusive`}>← Back to hub</Link>
      </Button>
      <ExclusiveProgramManager locale={locale} program={result.data} />
    </div>
  );
}
