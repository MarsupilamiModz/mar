"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

type RealtimeUser = {
  id: string;
  name: string;
  role: string;
};

type TypingUser = RealtimeUser & { at: number };

export function useTeamChatRealtime({
  channelId,
  currentUser,
  onNewMessage,
}: {
  channelId: string | null;
  currentUser: RealtimeUser;
  onNewMessage: () => void;
}) {
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const roomRef = useRef<RealtimeChannel | null>(null);
  const onNewMessageRef = useRef(onNewMessage);

  useEffect(() => {
    onNewMessageRef.current = onNewMessage;
  }, [onNewMessage]);

  const clearTyping = useCallback((userId: string) => {
    setTypingUsers((prev) => prev.filter((user) => user.id !== userId));
  }, []);

  useEffect(() => {
    if (!channelId) return;

    const supabase = createClient();
    const room = supabase.channel(`team-chat:${channelId}`, {
      config: { presence: { key: currentUser.id } },
    });
    roomRef.current = room;

    room
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ChatMessage",
          filter: `channelId=eq.${channelId}`,
        },
        () => onNewMessageRef.current()
      )
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const userId = String(payload?.userId ?? "");
        if (!userId || userId === currentUser.id) return;
        const userName = String(payload?.name ?? "Someone");
        const role = String(payload?.role ?? "");
        setTypingUsers((prev) => {
          const next = prev.filter((entry) => entry.id !== userId);
          return [...next, { id: userId, name: userName, role, at: Date.now() }];
        });
        window.setTimeout(() => clearTyping(userId), 2500);
      })
      .on("presence", { event: "sync" }, () => {
        const state = room.presenceState() as Record<string, Array<{ userId?: string }>>;
        const ids = new Set<string>();
        Object.values(state).forEach((entries) => {
          entries.forEach((entry) => {
            if (entry.userId) ids.add(String(entry.userId));
          });
        });
        setOnlineUserIds(Array.from(ids));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await room.track({
            userId: currentUser.id,
            name: currentUser.name,
            role: currentUser.role,
            activeChannelId: channelId,
            onlineAt: new Date().toISOString(),
          });
        }
      });

    const poll = window.setInterval(() => onNewMessageRef.current(), 15000);

    return () => {
      window.clearInterval(poll);
      setTypingUsers([]);
      setOnlineUserIds([]);
      void supabase.removeChannel(room);
      roomRef.current = null;
    };
  }, [channelId, clearTyping, currentUser.id, currentUser.name, currentUser.role]);

  const sendTyping = useCallback(
    (isTyping: boolean) => {
      if (!channelId || !roomRef.current) return;
      void roomRef.current.send({
        type: "broadcast",
        event: "typing",
        payload: {
          userId: currentUser.id,
          name: currentUser.name,
          role: currentUser.role,
          typing: isTyping,
        },
      });
    },
    [channelId, currentUser.id, currentUser.name, currentUser.role]
  );

  return useMemo(
    () => ({
      onlineUserIds,
      typingUsers,
      sendTyping,
    }),
    [onlineUserIds, typingUsers, sendTyping]
  );
}
