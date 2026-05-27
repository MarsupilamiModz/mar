"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { saveAdminMediaSettings } from "@/actions/mod-media";
import type { MediaSettings } from "@/lib/media-settings";
import { DEFAULT_MEDIA_SETTINGS } from "@/lib/media-settings";
import { useAppToast } from "@/hooks/use-app-toast";

type MediaSettingsPanelProps = {
  initial: MediaSettings;
};

export function MediaSettingsPanel({ initial }: MediaSettingsPanelProps) {
  const appToast = useAppToast();
  const [pending, startTransition] = useTransition();

  return (
    <Card className="glass max-w-2xl">
      <CardHeader>
        <CardTitle>Media Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const settings: MediaSettings = {
              minScreenshots: Number(fd.get("minScreenshots")),
              maxScreenshots: Number(fd.get("maxScreenshots")),
              allowedTypes: (fd.get("allowedTypes") as string)
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean)
                .map((ext) => `image/${ext}`),
              maxFileSizeMb: Number(fd.get("maxFileSizeMb")),
              imageQuality: Number(fd.get("imageQuality")) / 100,
            };
            startTransition(async () => {
              const r = await saveAdminMediaSettings(settings);
              if (r.success) appToast.saved();
              else appToast.error(r.error);
            });
          }}
          className="space-y-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm text-muted-foreground">Min screenshots</label>
              <Input name="minScreenshots" type="number" min={0} defaultValue={initial.minScreenshots} />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Max screenshots</label>
              <Input name="maxScreenshots" type="number" min={1} max={50} defaultValue={initial.maxScreenshots} />
            </div>
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Allowed file types (extensions)</label>
            <Input
              name="allowedTypes"
              defaultValue={initial.allowedTypes.map((t) => t.split("/")[1]).join(", ")}
              placeholder="jpeg, png, webp"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm text-muted-foreground">Max file size (MB)</label>
              <Input name="maxFileSizeMb" type="number" min={1} max={20} defaultValue={initial.maxFileSizeMb} />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Image quality (%)</label>
              <Input
                name="imageQuality"
                type="number"
                min={50}
                max={100}
                defaultValue={Math.round((initial.imageQuality ?? DEFAULT_MEDIA_SETTINGS.imageQuality) * 100)}
              />
            </div>
          </div>
          <Button type="submit" variant="neon" disabled={pending}>
            Save settings
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
