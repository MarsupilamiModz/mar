import { getUsers } from "@/actions/admin/users";
import { UsersTable } from "@/components/admin/users-table";
import type { Locale } from "@/i18n/config";

export default async function AdminUsersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: { page?: string; q?: string; role?: string; banned?: string };
}) {
  const { locale } = await params;

  const page = Number(searchParams.page) || 1;
  const result = await getUsers({
    page,
    search: searchParams.q,
    role: searchParams.role as never,
    banned:
      searchParams.banned === "banned"
        ? true
        : searchParams.banned === "active"
          ? false
          : undefined,
  });

  const data = result.success
    ? result.data
    : { users: [], total: 0, pages: 0, page: 1 };

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
        />
      </div>
    </div>
  );
}
