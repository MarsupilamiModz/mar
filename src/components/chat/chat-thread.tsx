"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ImageIcon, Paperclip } from "lucide-react";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { SafeImage } from "@/components/ui/safe-image";
import { formatDisplayName } from "@/lib/display-name";
import { safeToLocaleDateString } from "@/lib/i18n/safe-locale";
import { useR2MultipartUpload } from "@/hooks/use-r2-multipart-upload";
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
  attachments: Array<{
    url: string;
    key: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
  }>;
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
  participants,
  typingUsers,
  onlineUserIds,
  pending,
  onSend,
  onTyping,
}: {
  locale: string;
  userId: string;
  messages: MessageRow[];
  participants: Array<{
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    role: string;
    lastReadAt: Date | null;
  }>;
  typingUsers: Array<{ id: string; name: string; role: string }>;
  onlineUserIds: string[];
  pending: boolean;
  onSend: (
    content: string,
    attachments: Array<{ url: string; key: string; fileName: string; mimeType: string; fileSize: number }>
  ) => Promise<void>;
  onTyping: (isTyping: boolean) => void;
}) {
  const t = useTranslations("chat");
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const { upload, uploading, progress, error: uploadError } = useR2MultipartUpload();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function submit() {
    if (!content.trim() && files.length === 0) return;
    const uploadedAttachments: Array<{
      url: string;
      key: string;
      fileName: string;
      mimeType: string;
      fileSize: number;
    }> = [];

    for (const file of files) {
      const result = await upload({ file, purpose: "chat-attachment" });
      uploadedAttachments.push({
        url: result.url ?? "",
        key: result.key,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        fileSize: file.size,
      });
    }

    await onSend(content, uploadedAttachments);
    setContent("");
    setFiles([]);
    onTyping(false);
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">{t("emptyChannel")}</p>
        ) : (
          messages.map((msg) => {
            const mine = msg.sender.id === userId;
            const readers = participants.filter(
              (participant) =>
                participant.id !== userId &&
                participant.lastReadAt &&
                new Date(participant.lastReadAt).getTime() >= new Date(msg.createdAt).getTime()
            );
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
                  {msg.attachments.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {msg.attachments.map((attachment) => (
                        <div key={attachment.key} className="rounded-lg border border-border/50 bg-card/30 p-2">
                          {attachment.mimeType.startsWith("image/") ? (
                            <a href={attachment.url} target="_blank" rel="noreferrer" className="block">
                              <SafeImage
                                src={attachment.url}
                                alt={attachment.fileName}
                                width={480}
                                height={320}
                                className="max-h-56 w-auto rounded-md object-cover"
                              />
                            </a>
                          ) : (
                            <a
                              href={attachment.url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-2 text-sm hover:text-neon-purple"
                            >
                              <Paperclip className="h-4 w-4" />
                              <span className="truncate">{attachment.fileName}</span>
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {mine && readers.length > 0 && (
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {t("readBy")}: {readers.map((reader) => formatDisplayName(reader)).join(", ")}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border/40 p-3 space-y-2">
        {typingUsers.length > 0 && (
          <p className="text-[11px] text-muted-foreground">
            {typingUsers.map((user) => user.name).join(", ")} {t("typing")}
          </p>
        )}
        <Textarea
          placeholder={t("messagePlaceholder")}
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            onTyping(true);
            if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = window.setTimeout(() => onTyping(false), 1200);
          }}
          rows={2}
          className="resize-none text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          accept="image/*,application/pdf,.zip,.txt,.log,.json"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        />
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {files.map((file) => (
              <span key={`${file.name}-${file.size}`} className="rounded border border-border/40 px-2 py-0.5">
                {file.name}
              </span>
            ))}
          </div>
        )}
        {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
        <div className="flex justify-between items-center">
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground">{t("mentionHint")}</p>
            {onlineUserIds.length > 0 && (
              <p className="text-[10px] text-muted-foreground">
                {onlineUserIds.length} {t("online")}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" type="button" onClick={() => fileInputRef.current?.click()}>
              <ImageIcon className="mr-1 h-4 w-4" />
              {t("attach")}
            </Button>
            <Button
              variant="neon"
              size="sm"
              disabled={pending || uploading || (!content.trim() && files.length === 0)}
              onClick={submit}
            >
              {uploading ? `${t("uploading")} ${progress}%` : t("send")}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
