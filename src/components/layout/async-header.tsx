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
import { getCachedPublicBranding } from "@/lib/branding-data";
import { getNavGames } from "@/lib/nav-games";
import { getSafeLocale } from "@/lib/i18n/safe-locale";
import { isDynamicServerUsageError } from "@/lib/is-dynamic-server-error";

async function HeaderWithUser({ locale }: { locale: string }) {
  const safeLocale = getSafeLocale(locale);
  let user: NavUser | null = null;
  try {
    user = await getNavUser();
  } catch (err) {
    if (!isDynamicServerUsageError(err)) {
      console.error("[header] getNavUser failed", err);
    }
  }

  const [t, brandingBundle, navGames] = await Promise.all([
    getTranslations("nav"),
    getCachedPublicBranding(),
    getNavGames(),
  ]);
  const defaults = NAV_LABEL_DEFAULTS[safeLocale] ?? NAV_LABEL_DEFAULTS.en;

  const navLabels: NavLabels = {
    games: resolveNavLabel(t("games"), defaults.games),
    mods: resolveNavLabel(t("mods"), defaults.mods),
    collections: resolveNavLabel(t("collections"), defaults.collections),
    creators: resolveNavLabel(t("creators"), defaults.creators),
    partners: resolveNavLabel(t("partners"), defaults.partners),
    shop: resolveNavLabel(t("shop"), defaults.shop),
    leaderboards: resolveNavLabel(t("leaderboards"), defaults.leaderboards),
    premium: resolveNavLabel(t("premium"), defaults.premium),
    customOrders: resolveNavLabel(t("customOrders"), defaults.customOrders),
    developers: resolveNavLabel(t("developers"), defaults.developers),
    search: resolveNavLabel(t("search"), defaults.search),
  };

  return (
    <Header
      locale={safeLocale}
      user={user}
      navLabels={navLabels}
      header={brandingBundle.header}
      branding={brandingBundle.branding}
      navGames={navGames}
      allGamesLabel={t("allGames")}
    />
  );
}

export function AsyncHeader({ locale }: { locale: string }) {
  return (
    <Suspense fallback={<HeaderSkeleton />}>
      <HeaderWithUser locale={locale} />
    </Suspense>
  );
}

export type { NavUser };
