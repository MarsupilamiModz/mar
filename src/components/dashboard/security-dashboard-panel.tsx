"use client";

import { useState, useTransition } from "react";
import {
  enrollMfa,
  verifyAndEnableMfa,
  disableMfa,
  regenerateBackupCodes,
  listMfaFactors,
} from "@/actions/security";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { safeToLocaleDateString } from "@/lib/i18n/safe-locale";
import { Shield, Key } from "lucide-react";

type Dashboard = {
  mfaEnabled: boolean;
  mfaEnabledAt: Date | null;
  mfaRequired: boolean;
  backupCodesRemaining: number;
  failedLoginAttempts: number;
  recentEvents: {
    id: string;
    eventType: string;
    createdAt: Date;
    ipHash: string | null;
  }[];
};

export function SecurityDashboardPanel({
  locale,
  initial,
}: {
  locale: string;
  initial: Dashboard;
}) {
  const [dashboard] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [enrollData, setEnrollData] = useState<{ factorId: string; qrCode: string; secret: string } | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);

  function startEnroll() {
    startTransition(async () => {
      const r = await enrollMfa();
      if (r.success) {
        setEnrollData({ factorId: r.data.factorId, qrCode: r.data.qrCode, secret: r.data.secret });
      } else toast({ title: "Error", description: r.error, variant: "destructive" });
    });
  }

  function confirmEnroll() {
    if (!enrollData) return;
    startTransition(async () => {
      const r = await verifyAndEnableMfa(enrollData.factorId, verifyCode);
      if (r.success) {
        setBackupCodes(r.data.backupCodes);
        setEnrollData(null);
        toast({ title: "2FA enabled" });
        window.location.reload();
      } else toast({ title: "Error", description: r.error, variant: "destructive" });
    });
  }

  function loadFactors() {
    startTransition(async () => {
      const r = await listMfaFactors();
      if (r.success && r.data.factors.length > 0) {
        setFactorId(r.data.factors[0].id);
      }
    });
  }

  function disable() {
    if (!factorId) {
      loadFactors();
      return;
    }
    startTransition(async () => {
      const r = await disableMfa(factorId);
      if (r.success) {
        toast({ title: "2FA disabled" });
        window.location.reload();
      } else toast({ title: "Error", description: r.error, variant: "destructive" });
    });
  }

  function regenCodes() {
    startTransition(async () => {
      const r = await regenerateBackupCodes();
      if (r.success) {
        setBackupCodes(r.data.backupCodes);
        toast({ title: "Backup codes regenerated" });
      } else toast({ title: "Error", description: r.error, variant: "destructive" });
    });
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-neon-purple" />
            Two-Factor Authentication
            {dashboard.mfaRequired && !dashboard.mfaEnabled && (
              <Badge variant="destructive" className="ml-2">Required</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {dashboard.mfaEnabled
              ? "Your account is protected with an authenticator app."
              : "Add an extra layer of security with TOTP (Google Authenticator, Authy, etc.)."}
          </p>
          {dashboard.mfaEnabledAt && (
            <p className="text-xs text-muted-foreground">
              Enabled {safeToLocaleDateString(new Date(dashboard.mfaEnabledAt), locale, { dateStyle: "medium" })}
            </p>
          )}

          {!dashboard.mfaEnabled && !enrollData && (
            <Button variant="neon" disabled={pending} onClick={startEnroll}>
              Enable authenticator app
            </Button>
          )}

          {enrollData && (
            <div className="space-y-3 rounded-lg border border-border/40 p-4">
              <p className="text-sm">Scan this QR code with your authenticator app:</p>
              <div className="bg-white p-2 inline-block rounded" dangerouslySetInnerHTML={{ __html: enrollData.qrCode }} />
              <p className="text-xs font-mono text-muted-foreground break-all">Secret: {enrollData.secret}</p>
              <Input
                placeholder="Enter 6-digit code"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value)}
                maxLength={6}
              />
              <Button variant="neon" disabled={pending || verifyCode.length < 6} onClick={confirmEnroll}>
                Verify & enable
              </Button>
            </div>
          )}

          {dashboard.mfaEnabled && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled={pending} onClick={regenCodes}>
                <Key className="h-4 w-4 mr-1" />
                Regenerate backup codes ({dashboard.backupCodesRemaining} left)
              </Button>
              {!dashboard.mfaRequired && (
                <Button variant="outline" size="sm" disabled={pending} onClick={disable}>
                  Disable 2FA
                </Button>
              )}
            </div>
          )}

          {backupCodes && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-sm font-medium mb-2">Save these backup codes — shown once:</p>
              <ul className="grid grid-cols-2 gap-1 font-mono text-xs">
                {backupCodes.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader><CardTitle className="text-sm">Security activity</CardTitle></CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            Failed login attempts (recent): {dashboard.failedLoginAttempts}
          </p>
          {dashboard.recentEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No security events yet.</p>
          ) : (
            <ul className="space-y-2 text-xs max-h-48 overflow-y-auto">
              {dashboard.recentEvents.map((e) => (
                <li key={e.id} className="flex justify-between border-b border-border/30 pb-1">
                  <span>{e.eventType.replace(/_/g, " ")}</span>
                  <span className="text-muted-foreground">
                    {safeToLocaleDateString(new Date(e.createdAt), locale, { timeStyle: "short", dateStyle: "short" })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
