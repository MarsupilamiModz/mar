"use client";

import Link from "next/link";
import { Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { AuthButtons } from "@/components/layout/auth-buttons";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import type { NavLabels } from "@/components/layout/nav-labels";
import type { NavUser } from "@/components/layout/user-nav";
import { useState } from "react";

export function Header({
  locale,
  user,
  navLabels,
}: {
  locale: string;
  user: NavUser | null;
  navLabels: NavLabels;
}) {
  const [open, setOpen] = useState(false);

  const links = [
    { href: `/${locale}/games`, label: navLabels.games },
    { href: `/${locale}/mods`, label: navLabels.mods },
    { href: `/${locale}/creators`, label: navLabels.creators },
    { href: `/${locale}/partners`, label: navLabels.partners },
    { href: `/${locale}/shop`, label: navLabels.shop },
    { href: `/${locale}/leaderboards`, label: navLabels.leaderboards },
    { href: `/${locale}/premium`, label: navLabels.premium },
    { href: `/${locale}/custom-orders`, label: navLabels.customOrders },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href={`/${locale}`} className="shrink-0">
          <Logo size="sm" />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              prefetch
              className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
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
