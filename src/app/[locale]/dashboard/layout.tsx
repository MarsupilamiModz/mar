import Link from "next/link";
import { requireAuth } from "@/lib/auth";
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

const nav = [
  { href: "", icon: LayoutDashboard, label: "Overview" },
  { href: "/achievements", icon: Trophy, label: "Achievements" },
  { href: "/support", icon: LifeBuoy, label: "Support" },
  { href: "/orders", icon: Package, label: "Custom Orders" },
  { href: "/library", icon: BookOpen, label: "Library" },
  { href: "/following", icon: Users, label: "Following" },
  { href: "/downloads", icon: Download, label: "Downloads" },
  { href: "/favorites", icon: Heart, label: "Favorites" },
  { href: "/subscription", icon: CreditCard, label: "Membership" },
  { href: "/licenses", icon: Key, label: "Licenses" },
  { href: "/notifications", icon: Bell, label: "Notifications" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

import { AdLocationSlot } from "@/components/ads/ad-location-slot";

export default async function DashboardLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const user = await requireAuth(`/${locale}/login`);

  const navWithShop = [
    ...nav.map((item) => ({ ...item, dashboard: true as const })),
    { href: `/${locale}/shop`, icon: Coins, label: "Shop", dashboard: false as const },
  ];

  return (
    <div className="mx-auto flex max-w-7xl gap-8 px-4 py-8 sm:px-6">
      <aside className="hidden w-56 shrink-0 lg:block">
        <div className="glass rounded-xl p-4 sticky top-24">
          <p className="font-semibold truncate">{user.displayName ?? user.username}</p>
          <p className="text-xs text-muted-foreground mb-4">{formatRoleLabel(user.role)}</p>
          <nav className="space-y-1">
            {navWithShop.map((item) => (
              <Link
                key={item.label}
                href={item.dashboard ? `/${locale}/dashboard${item.href}` : item.href}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent/20 hover:text-foreground"
              >
                <item.icon className="h-4 w-4" />
                {item.label}
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
