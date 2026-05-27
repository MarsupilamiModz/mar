import { Suspense } from "react";
import { getNavUser } from "@/lib/nav-user";
import { Header } from "@/components/layout/header";
import { HeaderSkeleton } from "@/components/layout/header-skeleton";
import type { NavUser } from "@/components/layout/user-nav";

async function HeaderWithUser({ locale }: { locale: string }) {
  const user = await getNavUser();
  return <Header locale={locale} user={user} />;
}

export function AsyncHeader({ locale }: { locale: string }) {
  return (
    <Suspense fallback={<HeaderSkeleton />}>
      <HeaderWithUser locale={locale} />
    </Suspense>
  );
}

export type { NavUser };
