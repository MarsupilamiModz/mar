import { getUsers } from "@/actions/admin/users";
import { UsersTable } from "@/components/admin/users-table";
import type { Locale } from "@/i18n/config";
import { parseAdminLimit, parseAdminPage } from "@/lib/admin-pagination";

export default async function AdminUsersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{
    page?: string;
    limit?: string;
    q?: string;
    role?: string;
    banned?: string;
    deleted?: string;
  }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;

  const page = parseAdminPage(sp.page);
  const limit = parseAdminLimit(sp.limit);

  const result = await getUsers({
    page,
    limit,
    search: sp.q,
    role: sp.role as never,
    banned:
      sp.banned === "banned" ? true : sp.banned === "active" ? false : undefined,
    includeDeleted: sp.deleted === "1",
  });

  const data = result.success
    ? result.data
    : { users: [], total: 0, pages: 1, page: 1, limit };

  return (
    <div>
      <h1 className="text-2xl font-bold">User Management</h1>
      <p className="mt-1 text-sm text-muted-foreground">Manage roles, bans, and premium access</p>
      <div className="mt-8">
        <UsersTable
          locale={locale}
          initialUsers={data.users}
          initialTotal={data.total}
          initialPages={data.pages}
          initialPage={data.page}
          initialLimit={limit}
          initialQuery={sp}
        />
      </div>
    </div>
  );
}
