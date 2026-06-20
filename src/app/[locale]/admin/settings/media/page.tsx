import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getMediaSettings } from "@/lib/media-settings";
import { MediaSettingsPanel } from "@/components/admin/media-settings-panel";

export default async function AdminMediaSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireAdmin();
  const settings = await getMediaSettings();

  return (
    <div>
      <h1 className="text-2xl font-bold">Media Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Configure screenshot limits, file types, and compression for mod uploads.
      </p>
      <div className="mt-8 space-y-4">
        <MediaSettingsPanel initial={settings} />
        <p className="text-sm text-muted-foreground">
          <Link href={`/${locale}/admin/diagnostics/screenshots`} className="text-neon-purple hover:underline">
            Open screenshot diagnostics →
          </Link>
        </p>
      </div>
    </div>
  );
}
