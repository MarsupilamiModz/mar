"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { markNotificationRead, markAllNotificationsRead } from "@/actions/notifications";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTransition } from "react";
import { formatDateTime } from "@/lib/format-locale";

type Notification = {
  id: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: Date;
};

export function NotificationsList({ notifications, locale }: { notifications: Notification[]; locale: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (notifications.length === 0) {
    return <Card className="glass p-8 text-center text-muted-foreground">No notifications</Card>;
  }

  return (
    <div className="space-y-4">
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await markAllNotificationsRead();
            router.refresh();
          })
        }
      >
        Mark all read
      </Button>
      <div className="space-y-2">
        {notifications.map((n) => (
          <Card
            key={n.id}
            className={`glass p-4 ${!n.read ? "border-neon-purple/30" : ""}`}
            onClick={() =>
              !n.read &&
              startTransition(async () => {
                await markNotificationRead(n.id);
              })
            }
          >
            {n.link ? (
              <Link href={n.link}>
                <p className="font-medium">{n.title}</p>
                <p className="text-sm text-muted-foreground">{n.body}</p>
              </Link>
            ) : (
              <>
                <p className="font-medium">{n.title}</p>
                <p className="text-sm text-muted-foreground">{n.body}</p>
              </>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              {formatDateTime(n.createdAt, locale)}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
