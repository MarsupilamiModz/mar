"use client";

import { ChatChannelType } from "@prisma/client";
import { Hash, MessageCircle, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";
import { formatDisplayName } from "@/lib/display-name";

type ChannelRow = {
  id: string;
  slug: string;
  name: string;
  type: ChatChannelType;
  unread: number;
};

type StaffRow = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: string;
};

function channelIcon(type: ChatChannelType) {
  if (type === "DM") return MessageCircle;
  if (type === "DEPARTMENT") return Users;
  return Hash;
}

export function ChatSidebar({
  channels,
  staff,
  activeChannelId,
  onSelect,
  onStartDm,
  pending,
}: {
  locale: string;
  channels: ChannelRow[];
  staff: StaffRow[];
  activeChannelId: string | null;
  onSelect: (channelId: string) => void;
  onStartDm: (userId: string) => void;
  pending: boolean;
}) {
  const t = useTranslations("chat");

  const publicChannels = channels.filter((c) => c.type === "PUBLIC");
  const deptChannels = channels.filter((c) => c.type === "DEPARTMENT");
  const dmChannels = channels.filter((c) => c.type === "DM");

  function renderChannel(ch: ChannelRow) {
    const Icon = channelIcon(ch.type);
    const active = ch.id === activeChannelId;
    return (
      <button
        key={ch.id}
        type="button"
        onClick={() => onSelect(ch.id)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
          active ? "bg-neon-purple/20 text-neon-purple" : "text-muted-foreground hover:bg-accent/20 hover:text-foreground"
        )}
      >
        <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
        <span className="truncate flex-1">{ch.name}</span>
        {ch.unread > 0 && (
          <Badge variant="premium" className="h-5 min-w-5 px-1 text-[10px]">
            {ch.unread > 99 ? "99+" : ch.unread}
          </Badge>
        )}
      </button>
    );
  }

  return (
    <aside className="w-64 shrink-0 glass rounded-xl p-3 flex flex-col overflow-hidden">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2 mb-2">
        {t("channels")}
      </p>
      <div className="flex-1 overflow-y-auto space-y-4">
        {publicChannels.length > 0 && (
          <div className="space-y-0.5">
            <p className="text-[10px] uppercase text-muted-foreground px-2 mb-1">{t("public")}</p>
            {publicChannels.map(renderChannel)}
          </div>
        )}
        {deptChannels.length > 0 && (
          <div className="space-y-0.5">
            <p className="text-[10px] uppercase text-muted-foreground px-2 mb-1">{t("departments")}</p>
            {deptChannels.map(renderChannel)}
          </div>
        )}
        {dmChannels.length > 0 && (
          <div className="space-y-0.5">
            <p className="text-[10px] uppercase text-muted-foreground px-2 mb-1">{t("directMessages")}</p>
            {dmChannels.map(renderChannel)}
          </div>
        )}

        <div className="space-y-1 pt-2 border-t border-border/40">
          <p className="text-[10px] uppercase text-muted-foreground px-2 mb-1">{t("startDm")}</p>
          {staff.map((s) => (
            <Button
              key={s.id}
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              className="w-full justify-start gap-2 h-8 px-2 font-normal"
              onClick={() => onStartDm(s.id)}
            >
              <UserAvatar src={s.avatarUrl} name={formatDisplayName(s)} className="h-5 w-5" />
              <span className="truncate text-xs">@{s.username}</span>
            </Button>
          ))}
        </div>
      </div>
    </aside>
  );
}
