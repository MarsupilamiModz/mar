"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ChatChannelType } from "@prisma/client";
import {
  getChatMessages,
  getOrCreateDmChannel,
  listChatChannelsForUser,
  sendChatMessage,
} from "@/actions/team-chat";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { ChatThread } from "@/components/chat/chat-thread";
import { useTeamChatRealtime } from "@/hooks/use-team-chat-realtime";

type ChannelRow = {
  id: string;
  slug: string;
  name: string;
  type: ChatChannelType;
  department: string | null;
  description: string | null;
  unread: number;
  lastMessage: { content: string; createdAt: Date } | null;
  memberCount: number;
};

type StaffRow = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: string;
};

type MessageRow = {
  id: string;
  content: string;
  createdAt: Date;
  sender: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    role: string;
  };
  replyTo: {
    id: string;
    content: string;
    sender: { username: string; displayName: string | null };
  } | null;
};

export function AdminChatPageClient({
  locale,
  userId,
  initialChannels,
  initialStaff,
  initialChannelId,
}: {
  locale: string;
  userId: string;
  initialChannels: ChannelRow[];
  initialStaff: StaffRow[];
  initialChannelId?: string;
}) {
  const t = useTranslations("chat");
  const [channels, setChannels] = useState(initialChannels);
  const [staff] = useState(initialStaff);
  const [activeChannelId, setActiveChannelId] = useState(
    initialChannelId ?? initialChannels.find((c) => c.slug === "general")?.id ?? initialChannels[0]?.id ?? null
  );
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [channelMeta, setChannelMeta] = useState<{ name: string; type: ChatChannelType } | null>(null);
  const [pending, startTransition] = useTransition();
  const loadingRef = useRef(false);

  const refreshChannels = useCallback(async () => {
    const result = await listChatChannelsForUser();
    if (result.success) setChannels(result.data.channels as ChannelRow[]);
  }, []);

  const loadMessages = useCallback(async (channelId: string) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    const result = await getChatMessages(channelId);
    loadingRef.current = false;
    if (result.success) {
      setMessages(result.data.messages as MessageRow[]);
      setChannelMeta({ name: result.data.channel.name, type: result.data.channel.type });
      void refreshChannels();
    }
  }, [refreshChannels]);

  useEffect(() => {
    if (activeChannelId) void loadMessages(activeChannelId);
  }, [activeChannelId, loadMessages]);

  useTeamChatRealtime(activeChannelId, () => {
    if (activeChannelId) void loadMessages(activeChannelId);
  });

  function selectChannel(channelId: string) {
    setActiveChannelId(channelId);
  }

  function startDm(otherUserId: string) {
    startTransition(async () => {
      const result = await getOrCreateDmChannel(otherUserId);
      if (result.success) {
        await refreshChannels();
        setActiveChannelId(result.data.channelId);
      }
    });
  }

  function handleSend(content: string) {
    if (!activeChannelId || !content.trim()) return;
    startTransition(async () => {
      const result = await sendChatMessage({ channelId: activeChannelId, content });
      if (result.success) {
        setMessages((prev) => [...prev, result.data.message as MessageRow]);
        void refreshChannels();
      }
    });
  }

  const activeChannel = channels.find((c) => c.id === activeChannelId);

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-[480px] gap-4">
      <ChatSidebar
        locale={locale}
        channels={channels}
        staff={staff}
        activeChannelId={activeChannelId}
        onSelect={selectChannel}
        onStartDm={startDm}
        pending={pending}
      />
      <div className="flex-1 min-w-0 glass rounded-xl flex flex-col overflow-hidden">
        {activeChannel && channelMeta ? (
          <>
            <div className="border-b border-border/40 px-4 py-3">
              <h2 className="font-semibold">{activeChannel.name}</h2>
              {activeChannel.description && (
                <p className="text-xs text-muted-foreground mt-0.5">{activeChannel.description}</p>
              )}
            </div>
            <ChatThread
              locale={locale}
              userId={userId}
              messages={messages}
              pending={pending}
              onSend={handleSend}
            />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            {t("selectChannel")}
          </div>
        )}
      </div>
    </div>
  );
}
