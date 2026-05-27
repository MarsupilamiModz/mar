import { requireAdmin } from "@/lib/auth";
import { getMediaSettings } from "@/lib/media-settings";
import { MediaSettingsPanel } from "@/components/admin/media-settings-panel";

export default async function AdminMediaSettingsPage() {
  await requireAdmin();
  const settings = await getMediaSettings();

  return (
    <div>
      <h1 className="text-2xl font-bold">Media Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Configure screenshot limits, file types, and compression for mod uploads.
      </p>
      <div className="mt-8">
        <MediaSettingsPanel initial={settings} />
      </div>
    </div>
  );
}
