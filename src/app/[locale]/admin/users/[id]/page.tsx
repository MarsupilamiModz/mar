import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getUserDetail } from "@/actions/admin/users";
import { getAdminMembershipPlans } from "@/actions/admin/memberships";
import { getAdminPermissionGroups } from "@/actions/admin/branding";
import { UserDetailPanel } from "@/components/admin/user-detail-panel";
import type { Locale } from "@/i18n/config";

export default async function AdminUserDetailPage({
  params: { locale, id },
}: {
  params: { locale: Locale; id: string };
}) {
  const [result, plansResult, groupsResult] = await Promise.all([
    getUserDetail(id),
    getAdminMembershipPlans(),
    getAdminPermissionGroups(),
  ]);
  if (!result.success) notFound();
  const plans = plansResult.success ? plansResult.data : [];
  const permissionGroups = groupsResult.success
    ? groupsResult.data.map((g) => ({ id: g.id, name: g.name, slug: g.slug }))
    : [];

  return (
    <div>
      <Link
        href={`/${locale}/admin/users`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" /> Back to users
      </Link>
      <UserDetailPanel
        locale={locale}
        user={result.data.user}
        auditLogs={result.data.auditLogs}
        membershipPlans={plans}
        permissionGroups={permissionGroups}
      />
    </div>
  );
}
