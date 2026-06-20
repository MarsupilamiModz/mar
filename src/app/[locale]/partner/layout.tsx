import { requireAuth, redirectIfMfaRequired } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { StudioNav } from "@/components/studio/studio-nav";
import { isPartner } from "@/lib/permissions";
import type { Locale } from "@/i18n/config";

export const dynamic = "force-dynamic";

export default async function PartnerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;

  setRequestLocale(locale);
  const t = await getTranslations("ecosystem");
  const user = await requireAuth(`/${locale}/partner`);
  await redirectIfMfaRequired(user);
  const profile = await prisma.partnerProfile.findUnique({ where: { userId: user.id } });

  if (!profile && !isPartner(user.role)) {
    redirect(`/${locale}/dashboard/settings`);
  }

  const nav = [
    { href: "", label: t("overview") },
    { href: "/analytics", label: t("analytics") },
    { href: "/codes", label: t("codes") },
    { href: "/payouts", label: t("payouts") },
    { href: "/settings", label: t("profileSettings") },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gradient">{t("partnerStudio")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("partnerSubtitle")}</p>
      </div>
      <StudioNav locale={locale} base="/partner" items={nav} />
      {children}
    </div>
  );
}
