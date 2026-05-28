import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
const allLinks = [
  { href: "", label: "Overview", permission: "analytics.read" as const },
  { href: "/users", label: "Users", permission: "users.read" as const },
  { href: "/tickets", label: "Tickets", permission: "tickets.read" as const },
  { href: "/mods", label: "Mods", permission: "mods.read" as const },
  { href: "/games", label: "Games", permission: "games.write" as const },
  { href: "/analytics", label: "Analytics", permission: "analytics.read" as const },
  { href: "/subscriptions", label: "Purchases", permission: "subscriptions.read" as const },
  { href: "/coupons", label: "Coupons", permission: "coupons.write" as const },
  { href: "/creators", label: "Creators", permission: "users.read" as const },
  { href: "/partners", label: "Partners", permission: "users.read" as const },
  { href: "/commissions", label: "Commissions", permission: "settings.write" as const },
  { href: "/licenses", label: "License Keys", permission: "licenses.write" as const },
  { href: "/orders", label: "Orders", permission: "orders.read" as const },
  { href: "/audit", label: "Audit Logs", permission: "audit.read" as const },
  { href: "/announcements", label: "Announcements", permission: "settings.write" as const },
  { href: "/memberships", label: "Membership Pricing", permission: "settings.write" as const },
  { href: "/shop", label: "Shop", permission: "settings.write" as const },
  { href: "/payments", label: "Payments", permission: "settings.write" as const },
  { href: "/achievements", label: "Achievements", permission: "settings.write" as const },
  { href: "/leaderboards", label: "Leaderboards", permission: "settings.write" as const },
  { href: "/ads", label: "Advertising", permission: "settings.write" as const },
  { href: "/branding", label: "Branding", permission: "settings.write" as const },
  { href: "/groups", label: "Groups & Permissions", permission: "settings.write" as const },
  { href: "/localization", label: "AI Localization", permission: "settings.write" as const },
  { href: "/settings/media", label: "Media Settings", permission: "settings.write" as const },
];

export default async function AdminLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const user = await requireStaff();
  const links = allLinks.filter((l) => hasPermission(user.role, l.permission));

  return (
    <div className="mx-auto flex max-w-7xl gap-6 px-4 py-8 sm:px-6">
      <aside className="w-52 shrink-0 hidden md:block">
        <div className="glass rounded-xl p-4 sticky top-24">
          <p className="font-bold text-neon-purple mb-1">Admin</p>
          <p className="text-xs text-muted-foreground mb-4">@{user.username}</p>
          <nav className="space-y-1 text-sm">
            {links.map((l) => (
              <Link
                key={l.href}
                href={`/${locale}/admin${l.href}`}
                className="block rounded px-2 py-1.5 text-muted-foreground hover:bg-accent/20 hover:text-foreground"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </aside>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
