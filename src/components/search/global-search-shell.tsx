"use client";

import { GlobalSearchProvider } from "@/components/search/global-search-provider";
import { GlobalSearchDialog } from "@/components/search/global-search-dialog";

export function GlobalSearchShell({
  locale,
  children,
}: {
  locale: string;
  children: React.ReactNode;
}) {
  return (
    <GlobalSearchProvider>
      {children}
      <GlobalSearchDialog locale={locale} />
    </GlobalSearchProvider>
  );
}
