import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getUserDetail } from "@/actions/admin/users";
import { getAdminMembershipPlans } from "@/actions/admin/memberships";
import { getAdminUserMembership } from "@/actions/admin/user-membership";
import { getAdminPermissionGroups } from "@/actions/admin/branding";
import { UserDetailPanel } from "@/components/admin/user-detail-panel";
import type { Locale } from "@/i18n/config";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;

  const [result, plansResult, groupsResult, membershipResult] = await Promise.all([
    getUserDetail(id),
    getAdminMembershipPlans(),
    getAdminPermissionGroups(),
    getAdminUserMembership(id),
  ]);
  if (!result.success) notFound();
  const plans = plansResult.success ? plansResult.data : [];
  const permissionGroups = groupsResult.success
    ? groupsResult.data.map((g) => ({ id: g.id, name: g.name, slug: g.slug }))
    : [];

  const membership = membershipResult.success ? membershipResult.data : null;

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
        membershipState={membership?.state ?? null}
        billingHistory={membership?.billingHistory ?? []}
      />
    </div>
  );
}
