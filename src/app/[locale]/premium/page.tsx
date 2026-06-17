import { getActiveMembershipPlans, getPremiumPageSettings, localizedPlan, getUserMembershipTier } from "@/lib/membership";
import { getCurrentUser } from "@/lib/auth";
import { PremiumPlansClient } from "@/components/membership/premium-plans-client";
import type { Locale } from "@/i18n/config";

export default async function PremiumPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;

  const [plans, pageSettings, user] = await Promise.all([
    getActiveMembershipPlans(),
    getPremiumPageSettings(),
    getCurrentUser(),
  ]);

  let currentPlanSlug: string | null = null;
  if (user) {
    const tier = await getUserMembershipTier(user.id);
    currentPlanSlug = tier?.slug ?? null;
  }

  return (
    <PremiumPlansClient
      locale={locale}
      plans={plans.map((p) => localizedPlan(p, locale))}
      pageSettings={pageSettings}
      isLoggedIn={!!user}
      currentPlanSlug={currentPlanSlug}
    />
  );
}
