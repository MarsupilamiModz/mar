import { prisma } from "@/lib/db";
import { auditTranslationKeys } from "@/lib/i18n-audit";

export type PlatformAuditIssue = {
  severity: "error" | "warning" | "info";
  category: string;
  message: string;
  detail?: string;
};

export async function runPlatformAudit(): Promise<{
  issues: PlatformAuditIssue[];
  scannedAt: string;
}> {
  const issues: PlatformAuditIssue[] = [];

  const translation = auditTranslationKeys("en");
  for (const loc of translation.locales) {
    if (loc.missing.length > 0) {
      issues.push({
        severity: "warning",
        category: "translations",
        message: `${loc.missing.length} missing key(s) in locale "${loc.locale}"`,
        detail: loc.missing.slice(0, 15).join(", ") + (loc.missing.length > 15 ? "…" : ""),
      });
    }
  }

  const [gamesNoCover, gamesNoBanner, openTickets, failedEmail] = await Promise.all([
      prisma.game.count({ where: { isActive: true, OR: [{ coverUrl: null }, { coverUrl: "" }] } }),
      prisma.game.count({ where: { isActive: true, OR: [{ bannerUrl: null }, { bannerUrl: "" }] } }),
      prisma.supportTicket.count({
        where: { status: { in: ["OPEN", "ESCALATED", "WAITING_FOR_STAFF"] } },
      }),
      prisma.emailLog.count({ where: { status: "FAILED" } }).catch(() => 0),
    ]);

  if (gamesNoCover > 0) {
    issues.push({
      severity: "warning",
      category: "assets",
      message: `${gamesNoCover} active game(s) missing cover image`,
    });
  }
  if (gamesNoBanner > 0) {
    issues.push({
      severity: "info",
      category: "assets",
      message: `${gamesNoBanner} active game(s) missing banner image`,
    });
  }
  if (openTickets > 50) {
    issues.push({
      severity: "warning",
      category: "tickets",
      message: `${openTickets} open/escalated tickets need attention`,
    });
  }
  if (failedEmail > 0) {
    issues.push({
      severity: "error",
      category: "email",
      message: `${failedEmail} failed email(s) in log`,
    });
  }

  const envChecks: { key: string; label: string; severity: PlatformAuditIssue["severity"] }[] = [
    { key: "DATABASE_URL", label: "Database URL", severity: "error" },
    { key: "NEXT_PUBLIC_SUPABASE_URL", label: "Supabase URL", severity: "error" },
    { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", label: "Supabase anon key", severity: "error" },
    { key: "DISCORD_CLIENT_ID", label: "Discord OAuth client", severity: "warning" },
    { key: "STRIPE_SECRET_KEY", label: "Stripe secret", severity: "warning" },
  ];

  for (const check of envChecks) {
    if (!process.env[check.key]) {
      issues.push({
        severity: check.severity,
        category: "environment",
        message: `Missing ${check.label}`,
        detail: check.key,
      });
    }
  }

  if (issues.length === 0) {
    issues.push({
      severity: "info",
      category: "scan",
      message: "No critical issues detected",
    });
  }

  return { issues, scannedAt: new Date().toISOString() };
}
