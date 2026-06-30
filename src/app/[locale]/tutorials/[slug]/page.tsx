import { notFound } from "next/navigation";
import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { resolveAssetUrl } from "@/lib/assets";
import { getTutorialBySlug, incrementTutorialView } from "@/lib/tutorials/data";
import { TutorialDetail } from "@/components/tutorials/tutorial-detail";
import { Badge } from "@/components/ui/badge";
import type { Locale } from "@/i18n/config";

export const dynamic = "force-dynamic";

export default async function TutorialDetailPage({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const tutorial = await getTutorialBySlug(slug);
  if (!tutorial) notFound();

  void incrementTutorialView(tutorial.id);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <Link href={`/${locale}/tutorials`} className="text-sm text-muted-foreground hover:text-neon-purple">
        ← Alle Tutorials
      </Link>
      <div className="mt-4 flex flex-wrap gap-2">
        {tutorial.category ? <Badge variant="outline">{tutorial.category.name}</Badge> : null}
        <Badge variant="secondary">
          {tutorial.level === "BEGINNER"
            ? "Anfänger"
            : tutorial.level === "INTERMEDIATE"
              ? "Fortgeschritten"
              : "Profi"}
        </Badge>
      </div>
      <TutorialDetail
        locale={locale}
        tutorial={{
          ...tutorial,
          videoUrl:
            tutorial.videoUrl ??
            (tutorial.videoFileKey ? resolveAssetUrl(tutorial.videoFileKey) : null),
        }}
      />
    </div>
  );
}
