"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Bell, Check, Trash2 } from "lucide-react";
import {
  deleteNotification,
  getNotifications,
  getUnreadNotificationsCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/actions/notifications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDateTime } from "@/lib/format-locale";
import { getSafeLocale } from "@/lib/i18n/safe-locale";
import { createClient } from "@/lib/supabase/client";

type NotificationRow = {
  id: string;
  type: string;
  category: string | null;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: Date;
};

const CATEGORY_KEYS = [
  { id: "all", labelKey: "categoriesAll" },
  { id: "support", labelKey: "categoriesSupport" },
  { id: "orders", labelKey: "categoriesOrders" },
  { id: "premium", labelKey: "categoriesPremium" },
  { id: "system", labelKey: "categoriesSystem" },
] as const;

export function NotificationCenter({ locale, userId }: { locale: string; userId?: string | null }) {
  const td = useTranslations("dashboard");
  const safeLocale = getSafeLocale(locale);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    const [countRes, listRes] = await Promise.all([
      getUnreadNotificationsCount(),
      getNotifications({ search: search || undefined, category, limit: 30 }),
    ]);
    if (countRes.success) setUnread(countRes.data);
    if (listRes.success) setItems(listRes.data as NotificationRow[]);
  }, [search, category]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    void refresh();
    const interval = setInterval(() => void refresh(), 5000);
    return () => clearInterval(interval);
  }, [open, refresh]);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "Notification",
          filter: `userId=eq.${userId}`,
        },
        () => void refresh()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, refresh]);

  if (!userId) return null;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-neon-purple px-1 text-[10px] font-bold text-white">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(100vw-2rem,380px)] p-0 glass">
        <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
          <p className="font-semibold text-sm">{td("notifications")}</p>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            disabled={pending || unread === 0}
            onClick={() =>
              startTransition(async () => {
                await markAllNotificationsRead();
                await refresh();
              })
            }
          >
            <Check className="h-3.5 w-3.5 mr-1" /> {td("markAllRead")}
          </Button>
        </div>

        <div className="px-3 py-2 space-y-2 border-b border-border/30">
          <Input
            placeholder={td("searchNotifications")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-xs"
          />
          <div className="flex flex-wrap gap-1">
            {CATEGORY_KEYS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={`rounded-full px-2 py-0.5 text-[10px] border transition ${
                  category === c.id
                    ? "border-neon-purple bg-neon-purple/20 text-neon-purple"
                    : "border-border/50 text-muted-foreground"
                }`}
              >
                {td(c.labelKey)}
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">{td("noNotifications")}</p>
          ) : (
            items.map((n) => (
              <div
                key={n.id}
                className={`flex gap-2 border-b border-border/20 px-4 py-3 text-sm last:border-0 ${
                  !n.read ? "bg-neon-purple/5" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  {n.link ? (
                    <Link
                      href={n.link}
                      className="font-medium hover:text-neon-purple line-clamp-1"
                      onClick={() => {
                        if (!n.read) void markNotificationRead(n.id);
                        setOpen(false);
                      }}
                    >
                      {n.title}
                    </Link>
                  ) : (
                    <p className="font-medium line-clamp-1">{n.title}</p>
                  )}
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.body}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {!n.read && <Badge variant="premium" className="text-[9px] px-1 py-0">New</Badge>}
                    <span className="text-[10px] text-muted-foreground">
                      {formatDateTime(n.createdAt, safeLocale)}
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await deleteNotification(n.id);
                      await refresh();
                    })
                  }
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-border/40 p-2">
          <Button variant="ghost" size="sm" className="w-full text-xs" asChild>
            <Link href={`/${locale}/dashboard/notifications`} onClick={() => setOpen(false)}>
              {td("viewAllNotifications")}
            </Link>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
