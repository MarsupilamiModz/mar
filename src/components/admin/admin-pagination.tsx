"use client";

import Link from "next/link";
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ADMIN_PAGE_SIZE_OPTIONS,
  buildAdminQueryString,
  type AdminPageSize,
} from "@/lib/admin-pagination";
import { cn } from "@/lib/utils";

type Props = {
  page: number;
  pages: number;
  total: number;
  limit: AdminPageSize;
  /** URL mode: base path without query, e.g. /en/admin/mods */
  basePath?: string;
  searchParams?: Record<string, string | undefined>;
  /** Callback mode for client-refetch tables */
  onPageChange?: (page: number) => void;
  onLimitChange?: (limit: AdminPageSize) => void;
  disabled?: boolean;
  className?: string;
};

export function AdminPagination({
  page,
  pages,
  total,
  limit,
  basePath,
  searchParams = {},
  onPageChange,
  onLimitChange,
  disabled = false,
  className,
}: Props) {
  const urlMode = Boolean(basePath);

  function hrefFor(nextPage: number, nextLimit = limit) {
    if (!basePath) return "#";
    return `${basePath}${buildAdminQueryString(searchParams, { page: nextPage, limit: nextLimit })}`;
  }

  function goTo(nextPage: number) {
    if (disabled) return;
    onPageChange?.(nextPage);
  }

  function changeLimit(nextLimit: AdminPageSize) {
    if (disabled) return;
    if (urlMode && basePath) {
      window.location.href = hrefFor(1, nextLimit);
      return;
    }
    onLimitChange?.(nextLimit);
    onPageChange?.(1);
  }

  const canPrev = page > 1;
  const canNext = page < pages;

  const navBtn = (child: React.ReactNode, targetPage: number, label: string, enabled: boolean) => {
    if (urlMode && basePath) {
      return (
        <Button variant="outline" size="icon" className="h-8 w-8" asChild={enabled} disabled={!enabled || disabled}>
          {enabled ? (
            <Link href={hrefFor(targetPage)} aria-label={label}>
              {child}
            </Link>
          ) : (
            <span>{child}</span>
          )}
        </Button>
      );
    }
    return (
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        aria-label={label}
        disabled={!enabled || disabled}
        onClick={() => goTo(targetPage)}
      >
        {child}
      </Button>
    );
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-t border-border/40 pt-4 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <p className="text-sm text-muted-foreground">
        {total.toLocaleString()} total · Page {page} of {Math.max(pages, 1)}
      </p>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {navBtn(<ChevronFirst className="h-4 w-4" />, 1, "First page", canPrev)}
        {navBtn(<ChevronLeft className="h-4 w-4" />, page - 1, "Previous page", canPrev)}

        <span className="min-w-[7rem] px-2 text-center text-sm font-medium">
          {page} / {Math.max(pages, 1)}
        </span>

        {navBtn(<ChevronRight className="h-4 w-4" />, page + 1, "Next page", canNext)}
        {navBtn(<ChevronLast className="h-4 w-4" />, pages, "Last page", canNext)}

        <div className="ml-2 flex items-center gap-2 border-l border-border/40 pl-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Per page</span>
          <Select
            value={String(limit)}
            onValueChange={(v) => changeLimit(Number(v) as AdminPageSize)}
            disabled={disabled}
          >
            <SelectTrigger className="h-8 w-[4.5rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ADMIN_PAGE_SIZE_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
