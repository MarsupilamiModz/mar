import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { getPublicTeamPageData } from "@/lib/team-profiles";
import { TeamPageClient } from "@/components/team/team-page-client";
import { SITE } from "@/lib/site";
import type { Locale } from "@/i18n/config";

export const metadata: Metadata = {
  title: `Team | ${SITE.name}`,
  description: "Meet the Xumari Modz team — development, design, support, and partnerships.",
};

export const revalidate = 300;

export default async function TeamPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { departments, members } = await getPublicTeamPageData();

  return (
    <TeamPageClient
      departments={departments}
      members={members}
      contactTicketHref={`/${locale}/dashboard/support/new`}
    />
  );
}
