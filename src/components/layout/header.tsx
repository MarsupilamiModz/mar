"use client";

import Link from "next/link";
import { Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo, type LogoBranding } from "@/components/brand/logo";
import { AuthButtons } from "@/components/layout/auth-buttons";
import { GamesHoverMenu } from "@/components/layout/games-hover-menu";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import type { NavLabels } from "@/components/layout/nav-labels";
import type { NavUser } from "@/components/layout/user-nav";
import type { HeaderMenuItem, HeaderSettings } from "@/lib/branding-cms";
import type { NavGameItem } from "@/lib/nav-games";
import { useState } from "react";

function resolveMenuHref(locale: string, href: string) {
  if (href.startsWith("http")) return href;
  const path = href.startsWith("/") ? href : `/${href}`;
  return `/${locale}${path === "/" ? "" : path}`;
}

export function Header({
  locale,
  user,
  navLabels,
  header,
  branding,
  navGames = [],
  allGamesLabel = "All games",
}: {
  locale: string;
  user: NavUser | null;
  navLabels: NavLabels;
  header?: HeaderSettings | null;
  branding?: LogoBranding | null;
  navGames?: NavGameItem[];
  allGamesLabel?: string;
}) {
  const [open, setOpen] = useState(false);

  const labelMap: Record<string, string> = {
    games: navLabels.games,
    mods: navLabels.mods,
    collections: navLabels.collections,
    creators: navLabels.creators,
    partners: navLabels.partners,
    shop: navLabels.shop,
    leaderboards: navLabels.leaderboards,
    premium: navLabels.premium,
    "custom-orders": navLabels.customOrders,
  };

  const defaultLinks: HeaderMenuItem[] = [
    { id: "games", label: navLabels.games, href: "/games", hidden: false, order: 0 },
    { id: "mods", label: navLabels.mods, href: "/mods", hidden: false, order: 1 },
    { id: "collections", label: navLabels.collections, href: "/collections", hidden: false, order: 2 },
    { id: "creators", label: navLabels.creators, href: "/creators", hidden: false, order: 3 },
    { id: "partners", label: navLabels.partners, href: "/partners", hidden: false, order: 4 },
    { id: "shop", label: navLabels.shop, href: "/shop", hidden: false, order: 5 },
    { id: "leaderboards", label: navLabels.leaderboards, href: "/leaderboards", hidden: false, order: 6 },
    { id: "premium", label: navLabels.premium, href: "/premium", hidden: false, order: 7 },
    { id: "custom-orders", label: navLabels.customOrders, href: "/custom-orders", hidden: false, order: 8 },
  ];

  const links = (header?.menuItems?.length ? header.menuItems : defaultLinks)
    .filter((item) => !item.hidden)
    .sort((a, b) => a.order - b.order)
    .map((item) => ({
      href: resolveMenuHref(locale, item.href),
      label: labelMap[item.id] ?? item.label,
    }));

  const headerStyle = {
    height: header?.height ? `${header.height}px` : undefined,
    backgroundColor: header?.backgroundColor || undefined,
  };

  const headerClass = [
    header?.sticky !== false ? "sticky top-0 z-50" : "relative z-50",
    "border-b border-border/40",
    header?.transparent !== false ? "bg-background/80" : "bg-background",
    header?.blur !== false ? "backdrop-blur-xl supports-[backdrop-filter]:bg-background/60" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <header className={headerClass} style={headerStyle}>
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6" style={{ minHeight: header?.height ?? 64 }}>
        <Link href={`/${locale}`} className="shrink-0">
          <Logo size="sm" branding={branding} />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {links.map((l) =>
            l.href === `/${locale}/games` && navGames.length > 0 ? (
              <GamesHoverMenu
                key={l.href}
                locale={locale}
                label={l.label}
                games={navGames}
                allGamesLabel={allGamesLabel}
              />
            ) : (
              <Link
                key={l.href}
                href={l.href}
                prefetch
                className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
              >
                {l.label}
              </Link>
            )
          )}
        </nav>

        <div className="flex items-center gap-1 sm:gap-2">
          <Button variant="ghost" size="icon" asChild className="hidden sm:flex">
            <Link href={`/${locale}/mods`} aria-label={navLabels.search}>
              <Search className="h-4 w-4" />
            </Link>
          </Button>
          <LanguageSwitcher locale={locale} />
          <AuthButtons locale={locale} user={user} />
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div
        className={`overflow-hidden border-t border-border/40 transition-all duration-300 lg:hidden ${
          open ? "max-h-96 opacity-100" : "max-h-0 opacity-0 border-t-0"
        }`}
      >
        <nav className="flex flex-col gap-1 p-4">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-md px-3 py-2.5 text-sm hover:bg-white/5"
              onClick={() => setOpen(false)}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
