import Link from "next/link";
import { notFound } from "next/navigation";
import { getModForEdit } from "@/actions/mods";
import { getModDependencies } from "@/lib/mod-dependencies";
import { ModMediaUploader } from "@/components/mods/mod-media-uploader";
import { CreatorModVersionUpload } from "@/components/creator/creator-mod-version-upload";
import { CreatorModVersionManager } from "@/components/creator/creator-mod-version-manager";
import { CreatorModDependenciesEditor } from "@/components/creator/creator-mod-dependencies-editor";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth";
import { getMediaSettings } from "@/lib/media-settings";
import { mapModMedia } from "@/lib/mod-media";
import type { Locale } from "@/i18n/config";

export default async function ManageModPage({
  params: { locale, id },
}: {
  params: { locale: Locale; id: string };
}) {
  await requireAuth(`/${locale}/login`);
  const [result, mediaSettings, dependencies] = await Promise.all([
    getModForEdit(id),
    getMediaSettings(),
    getModDependencies(id).catch(() => []),
  ]);

  if (!result.success) notFound();
  const mod = result.data;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{mod.title}</h2>
        <Button variant="outline" asChild>
          <Link href={`/${locale}/mods/${mod.slug}`}>View public page</Link>
        </Button>
      </div>

      <CreatorModVersionUpload modId={mod.id} />

      <CreatorModVersionManager modId={mod.id} versions={mod.versions} />

      <CreatorModDependenciesEditor
        modId={mod.id}
        gameId={mod.game.id}
        initial={dependencies}
      />

      <ModMediaUploader
        modId={mod.id}
        media={mapModMedia(mod.media)}
        settings={mediaSettings}
      />
    </div>
  );
}
