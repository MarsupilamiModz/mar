"use client";

import Link from "next/link";
import { markNotificationRead, markAllNotificationsRead } from "@/actions/notifications";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTransition } from "react";

type Notification = {
  id: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: Date;
};

export function NotificationsList({ notifications }: { notifications: Notification[] }) {
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
            window.location.reload();
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
              {new Date(n.createdAt).toLocaleString()}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
