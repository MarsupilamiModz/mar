"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { SafeImage } from "@/components/ui/safe-image";
import { useAppToast } from "@/hooks/use-app-toast";
import { saveAdminAuthBranding } from "@/actions/admin/branding";
import { uploadViaApi } from "@/lib/upload-client";
import { formatUploadErrorMessage } from "@/lib/upload-errors";
import type { AuthBrandingSettings } from "@/lib/auth-branding";

export function AuthBrandingPanel({ initial }: { initial: AuthBrandingSettings }) {
  const router = useRouter();
  const appToast = useAppToast();
  const [pending, startTransition] = useTransition();
  const [settings, setSettings] = useState(initial);

  const upload = async (field: keyof AuthBrandingSettings, file: File, assetType: string) => {
    try {
      const result = await uploadViaApi({
        file,
        purpose: "branding-asset",
        brandingAssetType: assetType,
      });
      setSettings((prev) => ({ ...prev, [field]: result.url }));
    } catch (err) {
      appToast.error(formatUploadErrorMessage(err));
    }
  };

  const save = () => {
    startTransition(async () => {
      const r = await saveAdminAuthBranding(settings);
      if (r.success) {
        appToast.saved();
        router.refresh();
      } else appToast.error(r.error);
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="glass p-6 space-y-4">
        <h3 className="font-semibold">Authentication branding</h3>
        <p className="text-xs text-muted-foreground">
          Customize login and register pages. Changes preview live on the right.
        </p>

        {(
          [
            ["loginLogoUrl", "Login logo", "image/*", "login-logo"],
            ["registerLogoUrl", "Register logo", "image/*", "register-logo"],
            ["faviconUrl", "Auth favicon", "image/*,.ico", "auth-favicon"],
            ["backgroundUrl", "Background image", "image/*", "auth-background"],
          ] as const
        ).map(([field, label, accept, assetType]) => (
          <div key={field}>
            <label className="text-xs text-muted-foreground">{label}</label>
            <Input
              type="file"
              accept={accept}
              className="mt-1"
              disabled={pending}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(field, file, assetType);
              }}
            />
          </div>
        ))}

        <Input
          value={settings.loginTitle}
          onChange={(e) => setSettings({ ...settings, loginTitle: e.target.value })}
          placeholder="Login title"
        />
        <Textarea
          value={settings.loginDescription}
          onChange={(e) => setSettings({ ...settings, loginDescription: e.target.value })}
          rows={2}
          placeholder="Login description"
        />
        <Input
          value={settings.registerTitle}
          onChange={(e) => setSettings({ ...settings, registerTitle: e.target.value })}
          placeholder="Register title"
        />
        <Textarea
          value={settings.registerDescription}
          onChange={(e) => setSettings({ ...settings, registerDescription: e.target.value })}
          rows={2}
          placeholder="Register description"
        />
        <Input
          value={settings.discordButtonText}
          onChange={(e) => setSettings({ ...settings, discordButtonText: e.target.value })}
          placeholder="Discord button text"
        />
        <Input
          value={settings.microsoftButtonText}
          onChange={(e) => setSettings({ ...settings, microsoftButtonText: e.target.value })}
          placeholder="Microsoft button text"
        />
        <Button variant="neon" disabled={pending} onClick={save}>
          Save auth branding
        </Button>
      </Card>

      <Card className="glass p-6 space-y-4">
        <h3 className="font-semibold">Live preview</h3>
        <div
          className="relative rounded-xl border border-border/40 overflow-hidden min-h-[420px] p-6"
          style={
            settings.backgroundUrl
              ? {
                  backgroundImage: `url(${settings.backgroundUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        >
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
          <div className="relative mx-auto max-w-sm rounded-xl border border-border/40 bg-background/90 p-6 space-y-4">
            {settings.loginLogoUrl ? (
              <div className="relative mx-auto h-12 w-40">
                <SafeImage src={settings.loginLogoUrl} alt="" fill className="object-contain" />
              </div>
            ) : (
              <div className="h-12 flex items-center justify-center text-sm font-bold text-gradient">Xumari Modz</div>
            )}
            <div>
              <h4 className="text-xl font-bold">{settings.loginTitle}</h4>
              <p className="text-sm text-muted-foreground mt-1">{settings.loginDescription}</p>
            </div>
            <div className="space-y-2">
              <div className="h-9 rounded-md border border-input bg-muted/20" />
              <div className="h-9 rounded-md border border-input bg-muted/20" />
              <Button variant="neon" className="w-full" type="button">
                Sign in
              </Button>
              <Button variant="outline" className="w-full" type="button">
                {settings.discordButtonText}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
