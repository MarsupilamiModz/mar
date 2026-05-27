import Link from "next/link";
import { requireDesigner } from "@/lib/auth";
import { Palette, Package, MessageSquare, BarChart3, Plus } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { getTranslations } from "next-intl/server";

import { formatDisplayName } from "@/lib/display-name";
import { Settings } from "lucide-react";

const nav = [
  { href: "", icon: BarChart3, labelKey: "analytics" as const },
  { href: "/uploads", icon: Package, labelKey: "uploads" as const },
  { href: "/orders", icon: MessageSquare, labelKey: "orders" as const },
  { href: "/settings", icon: Settings, labelKey: "settings" as const },
  { href: "/new", icon: Plus, labelKey: "newAsset" as const },
];

export default async function DesignerLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: Locale };
}) {
  const user = await requireDesigner();
  const t = await getTranslations("designer");

  return (
    <div className="mx-auto flex max-w-7xl gap-8 px-4 py-8 sm:px-6">
      <aside className="hidden w-56 shrink-0 lg:block">
        <div className="glass rounded-xl p-4 sticky top-24">
          <div className="flex items-center gap-2 mb-1">
            <Palette className="h-4 w-4 text-neon-purple" />
            <p className="font-semibold">{t("title")}</p>
          </div>
          <p className="text-xs text-muted-foreground mb-4 truncate">{formatDisplayName(user)}</p>
          <nav className="space-y-1">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={`/${locale}/designer${item.href}`}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent/20 hover:text-foreground transition-colors"
              >
                <item.icon className="h-4 w-4" />
                {t(item.labelKey)}
              </Link>
            ))}
          </nav>
        </div>
      </aside>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
