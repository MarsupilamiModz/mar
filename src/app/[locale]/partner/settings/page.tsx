import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { StudioProfileUpload } from "@/components/studio/studio-profile-upload";
import type { Locale } from "@/i18n/config";

export default async function PartnerSettingsPage({ params: { locale } }: { params: { locale: Locale } }) {
  const user = await requireAuth(`/${locale}/login`);
  const profile = await prisma.partnerProfile.findUnique({ where: { userId: user.id } });
  if (!profile) {
    return <p className="text-muted-foreground">No partner profile found.</p>;
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-bold mb-4">Partner Profile</h2>
      <StudioProfileUpload
        avatarUrl={user.avatarUrl}
        bannerUrl={profile.bannerUrl}
        logoUrl={profile.logoUrl}
        avatarPurpose="partner-avatar"
        bannerPurpose="partner-banner"
        logoPurpose="partner-logo"
        showLogo
      />
    </div>
  );
}
