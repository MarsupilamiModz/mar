import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { getNavUser } from "@/lib/nav-user";
import { Header } from "@/components/layout/header";
import { HeaderSkeleton } from "@/components/layout/header-skeleton";
import {
  NAV_LABEL_DEFAULTS,
  resolveNavLabel,
  type NavLabels,
} from "@/components/layout/nav-labels";
import type { NavUser } from "@/components/layout/user-nav";
import type { Locale } from "@/i18n/config";

async function HeaderWithUser({ locale }: { locale: string }) {
  let user: NavUser | null = null;
  try {
    user = await getNavUser();
  } catch (err) {
    console.error("[header] getNavUser failed", err);
  }

  const t = await getTranslations("nav");
  const defaults = NAV_LABEL_DEFAULTS[locale as Locale] ?? NAV_LABEL_DEFAULTS.en;

  const navLabels: NavLabels = {
    games: resolveNavLabel(t("games"), defaults.games),
    mods: resolveNavLabel(t("mods"), defaults.mods),
    creators: resolveNavLabel(t("creators"), defaults.creators),
    partners: resolveNavLabel(t("partners"), defaults.partners),
    shop: resolveNavLabel(t("shop"), defaults.shop),
    leaderboards: resolveNavLabel(t("leaderboards"), defaults.leaderboards),
    premium: resolveNavLabel(t("premium"), defaults.premium),
    customOrders: resolveNavLabel(t("customOrders"), defaults.customOrders),
    search: resolveNavLabel(t("search"), defaults.search),
  };

  return <Header locale={locale} user={user} navLabels={navLabels} />;
}

export function AsyncHeader({ locale }: { locale: string }) {
  return (
    <Suspense fallback={<HeaderSkeleton />}>
      <HeaderWithUser locale={locale} />
    </Suspense>
  );
}

export type { NavUser };
