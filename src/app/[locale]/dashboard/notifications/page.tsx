import { requireAuth } from "@/lib/auth";
import { getNotifications } from "@/actions/notifications";
import { NotificationsList } from "@/components/dashboard/notifications-list";
import type { Locale } from "@/i18n/config";

export default async function NotificationsPage({ params: { locale } }: { params: { locale: Locale } }) {
  await requireAuth(`/${locale}/login`);
  const result = await getNotifications();
  const notifications = result.success ? result.data : [];

  return (
    <div>
      <h1 className="text-2xl font-bold">Notifications</h1>
      <div className="mt-6">
        <NotificationsList notifications={notifications} />
      </div>
    </div>
  );
}
