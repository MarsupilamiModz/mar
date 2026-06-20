import Link from "next/link";
import { requireAuth, redirectIfMfaRequired } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Plus } from "lucide-react";
import { StudioNav } from "@/components/studio/studio-nav";
import { isCreatorOrPartner } from "@/lib/permissions";
import type { Locale } from "@/i18n/config";

export const dynamic = "force-dynamic";

export default async function CreatorLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;

  setRequestLocale(locale);
  const t = await getTranslations("ecosystem");
  const user = await requireAuth(`/${locale}/creator`);
  await redirectIfMfaRequired(user);
  const profile = await prisma.creatorProfile.findUnique({ where: { userId: user.id } });

  const allowed =
    profile ||
    user.role === "CREATOR" ||
    isCreatorOrPartner(user.role);

  if (!allowed) {
    redirect(`/${locale}/dashboard/settings`);
  }

  const nav = [
    { href: "", label: t("overview") },
    { href: "/analytics", label: t("analytics") },
    { href: "/codes", label: t("codes") },
    { href: "/licenses", label: t("licenses") },
    { href: "/payouts", label: t("payouts") },
    { href: "/exclusive", label: "Exclusive Access" },
    { href: "/collections", label: "Collections" },
    { href: "/settings", label: t("profileSettings") },
    { href: "/mods/new", label: t("upload") },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gradient">{t("creatorStudio")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("creatorSubtitle")}</p>
        </div>
        <Link
          href={`/${locale}/creator/mods/new`}
          className="inline-flex items-center gap-1.5 text-sm text-neon-purple hover:underline"
        >
          <Plus className="h-4 w-4" /> {t("newMod")}
        </Link>
      </div>
      <StudioNav locale={locale} base="/creator" items={nav} />
      {children}
    </div>
  );
}
