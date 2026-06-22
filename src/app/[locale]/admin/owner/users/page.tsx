import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { getOwnerUserManagementOverview } from "@/actions/admin/owner-users";
import { OwnerUserManagementClient } from "@/components/admin/owner-user-management";

export const dynamic = "force-dynamic";

export default async function OwnerUsersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string; q?: string; role?: string; banned?: string }>;
}) {
  await requireOwner();
  const { locale } = await params;
  const sp = await searchParams;

  const result = await getOwnerUserManagementOverview({
    page: Number(sp.page) || 1,
    search: sp.q,
    role: sp.role as never,
    banned: sp.banned === "banned" ? true : sp.banned === "active" ? false : undefined,
  });

  if (!result.success) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-sm">
        {result.error}
      </div>
    );
  }

  return <OwnerUserManagementClient locale={locale} initial={result.data} />;
}
