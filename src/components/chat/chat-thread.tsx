"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatDisplayName } from "@/lib/display-name";
import { safeToLocaleDateString } from "@/lib/i18n/safe-locale";
import { cn } from "@/lib/utils";

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

function renderContent(content: string) {
  const parts = content.split(/(@[a-zA-Z0-9_]{2,32})/g);
  return parts.map((part, i) =>
    part.startsWith("@") ? (
      <span key={i} className="text-neon-purple font-medium">
        {part}
      </span>
    ) : (
      part
    )
  );
}

export function ChatThread({
  locale,
  userId,
  messages,
  pending,
  onSend,
}: {
  locale: string;
  userId: string;
  messages: MessageRow[];
  pending: boolean;
  onSend: (content: string) => void;
}) {
  const t = useTranslations("chat");
  const [content, setContent] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function submit() {
    if (!content.trim()) return;
    onSend(content);
    setContent("");
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">{t("emptyChannel")}</p>
        ) : (
          messages.map((msg) => {
            const mine = msg.sender.id === userId;
            return (
              <div
                key={msg.id}
                className={cn("flex gap-3", mine ? "flex-row-reverse" : "flex-row")}
              >
                <UserAvatar
                  src={msg.sender.avatarUrl}
                  name={formatDisplayName(msg.sender)}
                  className="h-8 w-8 shrink-0"
                />
                <div className={cn("max-w-[75%] min-w-0", mine && "text-right")}>
                  <div className={cn("flex items-center gap-2 mb-0.5", mine && "justify-end")}>
                    <span className="text-xs font-medium">{formatDisplayName(msg.sender)}</span>
                    <Badge variant="outline" className="text-[9px] px-1 py-0">
                      {msg.sender.role}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {safeToLocaleDateString(new Date(msg.createdAt), locale, {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>
                  {msg.replyTo && (
                    <p className="text-[10px] text-muted-foreground mb-1 border-l-2 border-neon-purple/40 pl-2">
                      {formatDisplayName(msg.replyTo.sender)}: {msg.replyTo.content.slice(0, 80)}
                    </p>
                  )}
                  <div
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm whitespace-pre-wrap",
                      mine
                        ? "border-neon-purple/30 bg-neon-purple/10"
                        : "border-border/50 bg-card/40"
                    )}
                  >
                    {renderContent(msg.content)}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border/40 p-3 space-y-2">
        <Textarea
          placeholder={t("messagePlaceholder")}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={2}
          className="resize-none text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <div className="flex justify-between items-center">
          <p className="text-[10px] text-muted-foreground">{t("mentionHint")}</p>
          <Button variant="neon" size="sm" disabled={pending || !content.trim()} onClick={submit}>
            {t("send")}
          </Button>
        </div>
      </div>
    </>
  );
}
