import { setRequestLocale } from "next-intl/server";
import { getLeaderboard, METRIC_LABELS, PUBLIC_LEADERBOARD_METRICS, syncCreatorRanks } from "@/lib/leaderboards";
import { getAllGames } from "@/lib/data";
import { LeaderboardClient } from "@/components/leaderboards/leaderboard-client";
import type { LeaderboardMetric, LeaderboardPeriod } from "@prisma/client";
import type { Locale } from "@/i18n/config";
import type { Metadata } from "next";

export const revalidate = 120;

export const metadata: Metadata = {
  title: "Creator Leaderboards",
  description: "Top creators ranked by downloads, revenue, growth, and community engagement.",
};

export default async function LeaderboardsPage({
  params: { locale },
  searchParams,
}: {
  params: { locale: Locale };
  searchParams: {
    metric?: string;
    period?: string;
    game?: string;
    q?: string;
  };
}) {
  setRequestLocale(locale);

  void syncCreatorRanks();

  const metric = (searchParams.metric?.toUpperCase() ?? "DOWNLOADS") as LeaderboardMetric;
  const period = (searchParams.period?.toUpperCase() ?? "ALL_TIME") as LeaderboardPeriod;
  const validMetric = PUBLIC_LEADERBOARD_METRICS.includes(metric) ? metric : "DOWNLOADS";

  const [entries, games] = await Promise.all([
    getLeaderboard({
      metric: validMetric,
      period,
      gameSlug: searchParams.game,
      search: searchParams.q,
      limit: 50,
    }),
    getAllGames(),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <LeaderboardClient
        locale={locale}
        entries={entries}
        games={games}
        initialMetric={validMetric}
        initialPeriod={period}
        initialGame={searchParams.game}
        initialSearch={searchParams.q}
      />
    </div>
  );
}
