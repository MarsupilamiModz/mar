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
} from "lucide-react";

const nav = [
  { href: "", icon: LayoutDashboard, label: "Overview" },
  { href: "/support", icon: LifeBuoy, label: "Support" },
  { href: "/orders", icon: Package, label: "Custom Orders" },
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

  return (
    <div className="mx-auto flex max-w-7xl gap-8 px-4 py-8 sm:px-6">
      <aside className="hidden w-56 shrink-0 lg:block">
        <div className="glass rounded-xl p-4 sticky top-24">
          <p className="font-semibold truncate">{user.displayName ?? user.username}</p>
          <p className="text-xs text-muted-foreground mb-4">{user.role}</p>
          <nav className="space-y-1">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={`/${locale}/dashboard${item.href}`}
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
