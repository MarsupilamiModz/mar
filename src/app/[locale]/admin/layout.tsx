import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireStaff } from "@/lib/auth";
import { userHasPermission } from "@/lib/permission-store";
import { formatDisplayName } from "@/lib/display-name";
import type { PermissionKey } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const linkDefs = [
  { href: "", labelKey: "overview", permission: "analytics.read" as const },
  { href: "/users", labelKey: "users", permission: "users.read" as const },
  { href: "/tickets", labelKey: "tickets", permission: "tickets.read" as const },
  { href: "/mods", labelKey: "mods", permission: "mods.read" as const },
  { href: "/games", labelKey: "games", permission: "games.write" as const },
  { href: "/analytics", labelKey: "analytics", permission: "analytics.read" as const },
  { href: "/subscriptions", labelKey: "subscriptions", permission: "subscriptions.read" as const },
  { href: "/coupons", labelKey: "coupons", permission: "coupons.write" as const },
  { href: "/creators", labelKey: "creators", permission: "users.read" as const },
  { href: "/applications", labelKey: "applications", permission: "users.read" as const },
  { href: "/partners", labelKey: "partners", permission: "users.read" as const },
  { href: "/commissions", labelKey: "commissions", permission: "settings.write" as const },
  { href: "/licenses", labelKey: "licenses", permission: "licenses.write" as const },
  { href: "/orders", labelKey: "orders", permission: "orders.read" as const },
  { href: "/audit", labelKey: "audit", permission: "audit.read" as const },
  { href: "/announcements", labelKey: "announcements", permission: "settings.write" as const },
  { href: "/memberships", labelKey: "memberships", permission: "settings.write" as const },
  { href: "/shop", labelKey: "shop", permission: "settings.write" as const },
  { href: "/payments", labelKey: "payments", permission: "settings.write" as const },
  { href: "/achievements", labelKey: "achievements", permission: "settings.write" as const },
  { href: "/leaderboards", labelKey: "leaderboards", permission: "settings.write" as const },
  { href: "/ads", labelKey: "ads", permission: "settings.write" as const },
  { href: "/email", labelKey: "emailSettings", permission: "settings.write" as const },
  { href: "/email/templates", labelKey: "emailTemplates", permission: "settings.write" as const },
  { href: "/branding", labelKey: "branding", permission: "settings.write" as const },
  { href: "/collections", labelKey: "collections", permission: "settings.write" as const },
  { href: "/groups", labelKey: "groups", permission: "settings.write" as const },
  { href: "/team", labelKey: "team", permission: "users.read" as const },
  { href: "/localization", labelKey: "localization", permission: "settings.write" as const },
  { href: "/settings/media", labelKey: "mediaSettings", permission: "settings.write" as const },
  { href: "/system", labelKey: "systemHealth", permission: "settings.write" as const },
  { href: "/security", labelKey: "securityCenter", permission: "settings.write" as const },
  { href: "/api-keys", labelKey: "apiKeys", permission: "settings.write" as const },
] as const;

async function filterLinks(user: { id: string; role: Parameters<typeof userHasPermission>[0]["role"]; permissionGroupId?: string | null }) {
  const links: typeof linkDefs[number][] = [];
  for (const link of linkDefs) {
    try {
      if (await userHasPermission(user, link.permission as PermissionKey)) {
        links.push(link);
      }
    } catch {
      /* skip */
    }
  }
  return links;
}

export default async function AdminLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  setRequestLocale(locale);
  const user = await requireStaff();
  const [links, t] = await Promise.all([filterLinks(user), getTranslations("admin")]);

  return (
    <div className="mx-auto flex max-w-7xl gap-6 px-4 py-8 sm:px-6">
      <aside className="w-52 shrink-0 hidden md:block">
        <div className="glass rounded-xl p-4 sticky top-24 dark-reader-lock">
          <p className="font-bold text-neon-purple mb-1">{t("panelTitle")}</p>
          <p className="text-xs text-muted-foreground mb-4 truncate">{formatDisplayName(user)}</p>
          <nav className="space-y-1 text-sm">
            {links.map((l) => (
              <Link
                key={l.href}
                href={`/${locale}/admin${l.href}`}
                className="block rounded px-2 py-1.5 text-muted-foreground hover:bg-accent/20 hover:text-foreground"
              >
                {t(l.labelKey)}
              </Link>
            ))}
          </nav>
        </div>
      </aside>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
