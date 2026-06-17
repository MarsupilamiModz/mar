import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CreatorSettingsForm } from "@/components/creator/creator-settings-form";
import { CreatorProfileUpload } from "@/components/creator/creator-profile-upload";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { Locale } from "@/i18n/config";

export default async function CreatorSettingsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;

  setRequestLocale(locale);
  const t = await getTranslations("ecosystem");
  const user = await requireAuth(`/${locale}/login`);

  const profile = await prisma.creatorProfile.findUnique({
    where: { userId: user.id },
    select: { bannerUrl: true, user: { select: { avatarUrl: true } } },
  });
  if (!profile) notFound();

  return (
    <div className="space-y-8">
      <h2 className="text-lg font-semibold">{t("profileSettings")}</h2>
      <CreatorProfileUpload avatarUrl={profile.user.avatarUrl} bannerUrl={profile.bannerUrl} />
      <CreatorSettingsForm locale={locale} />
    </div>
  );
}
