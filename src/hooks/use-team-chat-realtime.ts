"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function useTeamChatRealtime(
  channelId: string | null,
  onNewMessage: () => void
) {
  useEffect(() => {
    if (!channelId) return;

    const supabase = createClient();
    const realtime = supabase
      .channel(`chat:${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ChatMessage",
          filter: `channelId=eq.${channelId}`,
        },
        () => onNewMessage()
      )
      .subscribe();

    const poll = window.setInterval(() => onNewMessage(), 10000);

    return () => {
      window.clearInterval(poll);
      void supabase.removeChannel(realtime);
    };
  }, [channelId, onNewMessage]);
}
