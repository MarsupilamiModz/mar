import { requireAuth } from "@/lib/auth";
import { getNotifications } from "@/actions/notifications";
import { NotificationsList } from "@/components/dashboard/notifications-list";
import type { Locale } from "@/i18n/config";

export default async function NotificationsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;

  await requireAuth(`/${locale}/dashboard/notifications`);
  const result = await getNotifications();
  const notifications = result.success ? result.data : [];

  return (
    <div>
      <h1 className="text-2xl font-bold">Notifications</h1>
      <div className="mt-6">
        <NotificationsList notifications={notifications} locale={locale} />
      </div>
    </div>
  );
}
