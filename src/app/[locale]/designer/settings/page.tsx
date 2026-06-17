import { requireDesigner } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { StudioProfileUpload } from "@/components/studio/studio-profile-upload";
import type { Locale } from "@/i18n/config";

export default async function DesignerSettingsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;

  const user = await requireDesigner();
  const profile = await prisma.designerProfile.findUnique({ where: { userId: user.id } });

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-bold mb-4">Studio Profile</h2>
      <StudioProfileUpload
        avatarUrl={profile?.avatarUrl ?? user.avatarUrl}
        bannerUrl={profile?.bannerUrl}
        avatarPurpose="designer-avatar"
        bannerPurpose="designer-banner"
      />
    </div>
  );
}
