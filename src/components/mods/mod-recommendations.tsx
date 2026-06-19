import Link from "next/link";
import { getSimilarMods, getUsersAlsoDownloaded } from "@/lib/recommendations";
import { ModCard } from "@/components/mods/mod-card";
import type { Locale } from "@/i18n/config";

export async function ModRecommendations({
  modId,
  gameId,
  locale,
}: {
  modId: string;
  gameId: string;
  locale: Locale;
}) {
  const [similarMods, alsoDownloaded] = await Promise.all([
    getSimilarMods(modId, gameId, 4),
    getUsersAlsoDownloaded(modId, 4),
  ]);

  if (similarMods.length === 0 && alsoDownloaded.length === 0) return null;

  return (
    <>
      {similarMods.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold mb-4">Similar mods</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {similarMods.map((m) => (
              <ModCard key={m.id} mod={m} locale={locale} />
            ))}
          </div>
        </section>
      )}
      {alsoDownloaded.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold mb-4">Users also downloaded</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {alsoDownloaded.map((m) => (
              <ModCard key={m.id} mod={m} locale={locale} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

export async function DashboardRecommendations({
  userId,
  locale,
}: {
  userId: string;
  locale: string;
}) {
  try {
    const { getPersonalizedRecommendations } = await import("@/lib/recommendations");
    const recommendations = await getPersonalizedRecommendations(userId, 4);

    if (recommendations.length === 0) return null;

    return (
      <section className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recommended for you</h2>
          <Link href={`/${locale}/search`} className="text-sm text-neon-purple hover:underline">
            Browse all
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {recommendations.map((mod) => (
            <ModCard key={mod.id} mod={mod} locale={locale} />
          ))}
        </div>
      </section>
    );
  } catch {
    return null;
  }
}
