#!/usr/bin/env tsx
/**
 * Phase 9 — Platform validation suite.
 * Run: npm run validate:platform
 * Optional: BASE_URL=http://localhost:3000 npm run validate:platform
 */

import { existsSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

const ROOT = join(__dirname, "..");
const LOCALE = "en";

type CheckResult = { name: string; ok: boolean; detail?: string };

const results: CheckResult[] = [];

function check(name: string, ok: boolean, detail?: string) {
  results.push({ name, ok, detail });
  const icon = ok ? "✓" : "✗";
  console.log(`${icon} ${name}${detail ? ` — ${detail}` : ""}`);
}

function fileExists(relative: string): boolean {
  return existsSync(join(ROOT, relative));
}

function page(path: string): string {
  return `src/app/[locale]/${path}/page.tsx`;
}

const FLOWS: Record<string, string[]> = {
  Login: [page("login"), "src/app/[locale]/login/login-form.tsx", "src/app/api/auth/callback/route.ts"],
  Registration: [page("register"), "src/app/[locale]/register/register-form.tsx"],
  "Discord OAuth": [
    "src/app/api/auth/discord/route.ts",
    "src/app/api/auth/discord/callback/route.ts",
    "src/lib/discord.ts",
  ],
  Uploads: [
    "src/app/api/upload/route.ts",
    "src/app/api/r2/multipart/initiate/route.ts",
    "src/app/api/r2/multipart/complete/route.ts",
    "src/lib/upload-fetch.ts",
    "src/lib/r2-multipart-client.ts",
  ],
  Downloads: [
    "src/app/api/mods/[id]/download/route.ts",
    page("dashboard/downloads"),
    "src/lib/downloads.ts",
  ],
  "Mod Creation": [
    page("creator/mods/new"),
    page("creator/mods/[id]"),
    page("admin/mods/new"),
    "src/actions/mods.ts",
  ],
  "Sound Creation": [
    page("admin/mods/new-sound"),
    "src/actions/sounds.ts",
    "src/app/api/sounds/[modId]/stream/route.ts",
  ],
  Collections: [
    page("collections"),
    page("collections/[slug]"),
    page("creator/collections/new"),
    "src/actions/collections.ts",
  ],
  Modpacks: [page("collections"), "src/actions/collections.ts"],
  Tickets: [
    page("dashboard/support"),
    page("dashboard/support/new"),
    page("admin/tickets"),
    "src/actions/tickets.ts",
  ],
  "Team Chat": [
    page("team-chat"),
    page("admin/chat"),
    "src/actions/team-chat.ts",
    "src/hooks/use-team-chat-realtime.ts",
  ],
  Notifications: [
    page("dashboard/notifications"),
    "src/actions/notifications.ts",
    "src/components/layout/notification-center.tsx",
  ],
  Premium: [page("premium"), page("dashboard/subscription"), "src/app/api/stripe/checkout/route.ts"],
  Shop: [page("shop"), page("shop/[slug]"), page("admin/shop"), "src/actions/shop.ts"],
  "Admin Panel": [page("admin"), "src/app/[locale]/admin/layout.tsx"],
  "Owner Panel": [page("admin/owner"), page("admin/owner/health"), "src/actions/admin/owner.ts"],
  "Creator Panel": [page("creator"), "src/app/[locale]/creator/layout.tsx"],
  "Partner Panel": [page("partner"), "src/app/[locale]/partner/layout.tsx"],
};

const ERROR_RECOVERY = [
  "src/lib/error-diagnostics.ts",
  "src/lib/api-retry.ts",
  "src/lib/session-recovery.ts",
  "src/components/error/error-recovery-panel.tsx",
  "src/components/error/page-error.tsx",
  "src/app/global-error.tsx",
];

const PHASE_FEATURES = [
  "src/lib/system-health-monitor.ts",
  "src/components/admin/system-health-monitor.tsx",
  "src/components/admin/team-management-panel.tsx",
  "src/lib/team-page.ts",
  "src/lib/http-cache.ts",
  "src/lib/background-jobs.ts",
];

async function checkDatabase(): Promise<void> {
  try {
    const { checkDbHealth } = await import("../src/lib/db");
    const health = await checkDbHealth();
    check("Database connectivity", health.ok, health.detail);
  } catch (err) {
    check("Database connectivity", false, err instanceof Error ? err.message : String(err));
  }
}

async function checkHttp(baseUrl: string): Promise<void> {
  const publicRoutes: Array<{ path: string; expect: number | "2xx" | "redirect" }> = [
    { path: `/${LOCALE}/login`, expect: "2xx" },
    { path: `/${LOCALE}/register`, expect: "2xx" },
    { path: `/${LOCALE}/shop`, expect: "2xx" },
    { path: `/${LOCALE}/collections`, expect: "2xx" },
    { path: `/${LOCALE}/premium`, expect: "2xx" },
    { path: `/${LOCALE}/team`, expect: "2xx" },
    { path: `/${LOCALE}/mods`, expect: "2xx" },
    { path: `/${LOCALE}/dashboard`, expect: "redirect" },
    { path: `/${LOCALE}/admin`, expect: "redirect" },
    { path: `/${LOCALE}/creator`, expect: "redirect" },
    { path: `/${LOCALE}/partner`, expect: "redirect" },
    { path: `/${LOCALE}/team-chat`, expect: "redirect" },
    { path: `/${LOCALE}/admin/owner`, expect: "redirect" },
  ];

  for (const route of publicRoutes) {
    try {
      const res = await fetch(`${baseUrl}${route.path}`, {
        redirect: "manual",
        headers: { "Cache-Control": "no-cache" },
      });
      let ok = false;
      if (route.expect === "redirect") {
        ok = res.status >= 300 && res.status < 400;
        if (!ok && res.status >= 200 && res.status < 300) {
          const location = res.headers.get("location") ?? "";
          ok = location.includes("/login");
        }
      } else if (route.expect === "2xx") {
        ok = res.status >= 200 && res.status < 300;
      } else {
        ok = res.status === route.expect;
      }
      check(`HTTP ${route.path}`, ok, `status ${res.status}`);
    } catch (err) {
      check(`HTTP ${route.path}`, false, err instanceof Error ? err.message : "unreachable");
    }
  }

  const apiRoutes: Array<{ path: string; expect: number | "2xx" | "401" }> = [
    { path: "/api/auth/me", expect: "2xx" },
    { path: "/api/v1/games", expect: "401" },
    { path: "/api/v1/mods", expect: "401" },
    { path: "/api/v1/collections", expect: "401" },
  ];

  for (const route of apiRoutes) {
    try {
      const res = await fetch(`${baseUrl}${route.path}`, { redirect: "manual" });
      const ok =
        route.expect === "2xx"
          ? res.status >= 200 && res.status < 300
          : route.expect === "401"
            ? res.status === 401
            : res.status === route.expect;
      check(`HTTP ${route.path}`, ok, `status ${res.status}`);
    } catch (err) {
      check(`HTTP ${route.path}`, false, err instanceof Error ? err.message : "unreachable");
    }
  }
}

async function main() {
  console.log("\n=== Phase 9 Platform Validation ===\n");

  console.log("-- Flow file checks --");
  for (const [flow, files] of Object.entries(FLOWS)) {
    const missing = files.filter((f) => !fileExists(f));
    check(`Flow: ${flow}`, missing.length === 0, missing.length ? `missing: ${missing.join(", ")}` : undefined);
  }

  console.log("\n-- Error recovery --");
  for (const file of ERROR_RECOVERY) {
    check(`Recovery: ${file}`, fileExists(file));
  }

  console.log("\n-- Phase feature files --");
  for (const file of PHASE_FEATURES) {
    check(`Feature: ${file}`, fileExists(file));
  }

  console.log("\n-- TypeScript --");
  try {
    execSync("npx tsc --noEmit", { cwd: ROOT, stdio: "pipe" });
    check("TypeScript compilation", true);
  } catch (err) {
    const output = err instanceof Error && "stdout" in err ? String((err as { stdout: Buffer }).stdout) : "";
    check("TypeScript compilation", false, output.slice(0, 200) || "failed");
  }

  console.log("\n-- Database --");
  await checkDatabase();

  const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
  console.log(`\n-- HTTP (${baseUrl}) --`);
  try {
    const ping = await fetch(`${baseUrl}/${LOCALE}/login`, { signal: AbortSignal.timeout(15000) });
    if (ping.status >= 200 && ping.status < 500) {
      await checkHttp(baseUrl);
    } else {
      check("Dev server reachable", false, `status ${ping.status} — skip HTTP route tests`);
    }
  } catch {
    console.log("  (server not running — skipping HTTP tests; start with npm run dev)");
  }

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);

  console.log(`\n=== Results: ${passed}/${results.length} passed ===`);
  if (failed.length > 0) {
    console.log("\nFailed checks:");
    for (const f of failed) {
      console.log(`  • ${f.name}${f.detail ? `: ${f.detail}` : ""}`);
    }
    process.exit(1);
  }

  console.log("\nAll validation checks passed.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
