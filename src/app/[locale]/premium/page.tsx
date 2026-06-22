import { getActiveMembershipPlans, getPremiumPageSettings, localizedPlan, getUserMembershipTier } from "@/lib/membership";
import { getCurrentUser } from "@/lib/auth";
import { PremiumPlansClient } from "@/components/membership/premium-plans-client";
import type { Locale } from "@/i18n/config";

function serializePlansForClient(
  plans: Awaited<ReturnType<typeof getActiveMembershipPlans>>,
  locale: string
) {
  return plans.map((p) => {
    const localized = localizedPlan(p, locale);
    return {
      ...localized,
      saleEndsAt: localized.saleEndsAt ? localized.saleEndsAt.toISOString() : null,
    };
  });
}

export default async function PremiumPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;

  const [plans, pageSettings, user] = await Promise.all([
    getActiveMembershipPlans(),
    getPremiumPageSettings(),
    getCurrentUser(),
  ]);

  let currentPlanSlug: string | null = null;
  if (user) {
    try {
      const tier = await getUserMembershipTier(user.id);
      currentPlanSlug = tier?.slug ?? null;
    } catch (err) {
      console.error("[premium] getUserMembershipTier failed", err);
    }
  }

  return (
    <PremiumPlansClient
      locale={locale}
      plans={serializePlansForClient(plans, locale)}
      pageSettings={pageSettings}
      isLoggedIn={!!user}
      currentPlanSlug={currentPlanSlug}
    />
  );
}
