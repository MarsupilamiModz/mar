"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildAdminQueryString } from "@/lib/admin-pagination";
import { cn } from "@/lib/utils";

type FilterParams = {
  page?: string;
  limit?: string;
  type?: string;
  status?: string;
  pricing?: string;
  sort?: string;
  q?: string;
  gameId?: string;
  featured?: string;
  scheduled?: string;
};

type Props = {
  locale: string;
  searchParams: FilterParams;
  games: { id: string; name: string }[];
};

function filterHref(locale: string, base: FilterParams, patch: Partial<FilterParams>) {
  const merged = { ...base, ...patch, page: undefined };
  return `/${locale}/admin/mods${buildAdminQueryString(merged as Record<string, string | undefined>, {})}`;
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button variant={active ? "default" : "outline"} size="sm" asChild>
      <Link href={href}>{children}</Link>
    </Button>
  );
}

export function AdminModsToolbar({ locale, searchParams, games }: Props) {
  const router = useRouter();
  const sp = searchParams;

  function submitSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const q = String(fd.get("q") ?? "").trim();
    router.push(filterHref(locale, sp, { q: q || undefined }));
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submitSearch} className="flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Search mods by title or slug…"
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="neon" size="sm">
          Search
        </Button>
      </form>

      <div className="flex flex-wrap gap-2">
        <FilterLink href={filterHref(locale, sp, { type: undefined, status: undefined, pricing: undefined, featured: undefined, scheduled: undefined })} active={!sp.type && !sp.status && !sp.pricing && !sp.featured && !sp.scheduled}>
          All
        </FilterLink>
        <FilterLink href={filterHref(locale, sp, { type: "MOD" })} active={sp.type === "MOD"}>
          Mods
        </FilterLink>
        <FilterLink href={filterHref(locale, sp, { type: "SOUND" })} active={sp.type === "SOUND"}>
          Sounds
        </FilterLink>
        <FilterLink href={filterHref(locale, sp, { status: "PUBLISHED" })} active={sp.status === "PUBLISHED"}>
          Approved
        </FilterLink>
        <FilterLink href={filterHref(locale, sp, { status: "PENDING" })} active={sp.status === "PENDING"}>
          Pending
        </FilterLink>
        <FilterLink href={filterHref(locale, sp, { status: "REJECTED" })} active={sp.status === "REJECTED"}>
          Rejected
        </FilterLink>
        <FilterLink href={filterHref(locale, sp, { status: "DRAFT" })} active={sp.status === "DRAFT"}>
          Draft
        </FilterLink>
        <FilterLink href={filterHref(locale, sp, { status: "ARCHIVED" })} active={sp.status === "ARCHIVED"}>
          Archived
        </FilterLink>
        <FilterLink href={filterHref(locale, sp, { scheduled: "1" })} active={sp.scheduled === "1"}>
          Scheduled
        </FilterLink>
        <FilterLink href={filterHref(locale, sp, { featured: "1" })} active={sp.featured === "1"}>
          Featured
        </FilterLink>
        <FilterLink href={filterHref(locale, sp, { pricing: "FREE" })} active={sp.pricing === "FREE"}>
          Free
        </FilterLink>
        <FilterLink href={filterHref(locale, sp, { pricing: "PREMIUM" })} active={sp.pricing === "PREMIUM"}>
          Premium
        </FilterLink>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={sp.sort ?? "newest"}
          onValueChange={(sort) => router.push(filterHref(locale, sp, { sort }))}
        >
          <SelectTrigger className={cn("w-[180px]")}>
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="oldest">Oldest</SelectItem>
            <SelectItem value="downloads">Most downloads</SelectItem>
            <SelectItem value="rating">Best rating</SelectItem>
            <SelectItem value="alpha">Alphabetical</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={sp.gameId ?? "all"}
          onValueChange={(gameId) =>
            router.push(filterHref(locale, sp, { gameId: gameId === "all" ? undefined : gameId }))
          }
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All games" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All games</SelectItem>
            {games.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
