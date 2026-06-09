import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  Download,
  Heart,
  LayoutDashboard,
  Key,
  Settings,
  Bell,
  CreditCard,
  LifeBuoy,
  Package,
  Coins,
  Users,
  BookOpen,
  Trophy,
} from "lucide-react";
import { formatRoleLabel } from "@/lib/role-display";
import { AdLocationSlot } from "@/components/ads/ad-location-slot";

const navDefs = [
  { href: "", icon: LayoutDashboard, labelKey: "overview" },
  { href: "/achievements", icon: Trophy, labelKey: "achievements" },
  { href: "/support", icon: LifeBuoy, labelKey: "support" },
  { href: "/orders", icon: Package, labelKey: "customOrders" },
  { href: "/library", icon: BookOpen, labelKey: "library" },
  { href: "/following", icon: Users, labelKey: "following" },
  { href: "/downloads", icon: Download, labelKey: "downloads" },
  { href: "/favorites", icon: Heart, labelKey: "favorites" },
  { href: "/subscription", icon: CreditCard, labelKey: "membership" },
  { href: "/licenses", icon: Key, labelKey: "licenses" },
  { href: "/notifications", icon: Bell, labelKey: "notifications" },
  { href: "/settings", icon: Settings, labelKey: "settings" },
] as const;

export default async function DashboardLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  setRequestLocale(locale);
  const [user, t] = await Promise.all([
    requireAuth(`/${locale}/login`),
    getTranslations("dashboard"),
  ]);

  const navWithShop = [
    ...navDefs.map((item) => ({ ...item, dashboard: true as const })),
    { href: `/${locale}/shop`, icon: Coins, labelKey: "shop" as const, dashboard: false as const },
  ];

  return (
    <div className="mx-auto flex max-w-7xl gap-8 px-4 py-8 sm:px-6">
      <aside className="hidden w-56 shrink-0 lg:block">
        <div className="glass rounded-xl p-4 sticky top-24 dark-reader-lock">
          <p className="font-semibold truncate">{user.displayName ?? user.username}</p>
          <p className="text-xs text-muted-foreground mb-4">{formatRoleLabel(user.role)}</p>
          <nav className="space-y-1">
            {navWithShop.map((item) => (
              <Link
                key={item.labelKey}
                href={item.dashboard ? `/${locale}/dashboard${item.href}` : item.href}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent/20 hover:text-foreground"
              >
                <item.icon className="h-4 w-4" />
                {t(item.labelKey)}
              </Link>
            ))}
          </nav>
        </div>
      </aside>
      <div className="flex-1 min-w-0 space-y-4">
        <AdLocationSlot location="dashboard" />
        {children}
      </div>
    </div>
  );
}
