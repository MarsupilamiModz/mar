"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { saveOwnerFeatureFlags } from "@/actions/admin/feature-flags";
import {
  FEATURE_FLAG_LABELS,
  type FeatureFlagKey,
  type FeatureFlags,
} from "@/lib/feature-flags";
import { useAppToast } from "@/hooks/use-app-toast";

export function FeatureFlagsPanel({ initial }: { initial: FeatureFlags }) {
  const router = useRouter();
  const appToast = useAppToast();
  const [flags, setFlags] = useState(initial);
  const [pending, startTransition] = useTransition();

  const toggle = (key: FeatureFlagKey, enabled: boolean) => {
    setFlags((prev) => ({ ...prev, [key]: enabled }));
  };

  const save = () => {
    startTransition(async () => {
      const r = await saveOwnerFeatureFlags(flags);
      if (r.success) {
        appToast.saved();
        router.refresh();
      } else appToast.error(r.error);
    });
  };

  return (
    <Card className="glass p-6 space-y-4">
      <div>
        <h3 className="font-semibold">Feature flags</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Enable or disable platform features without redeploying.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {(Object.keys(FEATURE_FLAG_LABELS) as FeatureFlagKey[]).map((key) => (
          <label
            key={key}
            className="flex items-center justify-between rounded-lg border border-border/40 px-4 py-3"
          >
            <span className="text-sm font-medium">{FEATURE_FLAG_LABELS[key]}</span>
            <Switch checked={flags[key]} onCheckedChange={(v) => toggle(key, v)} />
          </label>
        ))}
      </div>
      <Button variant="neon" disabled={pending} onClick={save}>
        Save feature flags
      </Button>
    </Card>
  );
}
