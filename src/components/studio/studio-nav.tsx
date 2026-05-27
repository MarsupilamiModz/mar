"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function StudioNav({
  locale,
  base,
  items,
}: {
  locale: string;
  base: string;
  items: { href: string; label: string }[];
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-1 mb-8 p-1 rounded-xl bg-card/30 border border-border/40 backdrop-blur-sm">
      {items.map((item) => {
        const href = `/${locale}${base}${item.href}`;
        const active = pathname === href || (item.href !== "" && pathname.startsWith(href));
        return (
          <Link
            key={item.href}
            href={href}
            prefetch
            className={cn(
              "px-3 py-2 rounded-lg text-sm transition-all",
              active
                ? "bg-neon-purple/20 text-foreground font-medium shadow-neon"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/20"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
