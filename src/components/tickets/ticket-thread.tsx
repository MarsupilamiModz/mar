"use client";

import { useState, useTransition } from "react";
import { TicketStatus } from "@prisma/client";
import { replyToTicket, closeTicket, reopenTicket, addInternalNote } from "@/actions/tickets";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { TICKET_STATUS_LABELS, TICKET_CATEGORY_LABELS, TICKET_PRIORITY_LABELS } from "@/lib/ticket-labels";
import { formatDisplayName } from "@/lib/display-name";
import { cn } from "@/lib/utils";

type Message = {
  id: string;
  content: string;
  isStaff: boolean;
  isInternal?: boolean;
  createdAt: Date;
  sender: { username: string; displayName?: string | null; avatarUrl: string | null; role: string };
};

type Ticket = {
  id: string;
  ticketNumber: string;
  subject: string;
  category: keyof typeof TICKET_CATEGORY_LABELS;
  priority: keyof typeof TICKET_PRIORITY_LABELS;
  status: TicketStatus;
  closedAt: Date | null;
  user: { username: string };
  messages: Message[];
};

export function TicketThread({
  ticket,
  isStaff,
  canReply,
}: {
  ticket: Ticket;
  isStaff: boolean;
  canReply: boolean;
}) {
  const [content, setContent] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [pending, startTransition] = useTransition();

  function sendReply() {
    if (!content.trim()) return;
    startTransition(async () => {
      const result = await replyToTicket(ticket.id, content, isStaff);
      if (result.success) {
        setContent("");
        toast({ title: "Reply sent" });
        window.location.reload();
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      }
    });
  }

  function sendInternalNote() {
    if (!internalNote.trim() || !isStaff) return;
    startTransition(async () => {
      const result = await addInternalNote(ticket.id, internalNote);
      if (result.success) {
        setInternalNote("");
        toast({ title: "Internal note added" });
        window.location.reload();
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      }
    });
  }

  function handleClose() {
    startTransition(async () => {
      const result = await closeTicket(ticket.id, !isStaff);
      if (result.success) {
        toast({ title: "Ticket closed" });
        window.location.reload();
      }
    });
  }

  function handleReopen() {
    startTransition(async () => {
      const result = await reopenTicket(ticket.id);
      if (result.success) {
        toast({ title: "Ticket reopened" });
        window.location.reload();
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{ticket.ticketNumber}</Badge>
        <Badge variant="outline">{TICKET_CATEGORY_LABELS[ticket.category]}</Badge>
        <Badge variant="outline">{TICKET_PRIORITY_LABELS[ticket.priority]}</Badge>
        <Badge variant={ticket.status === "CLOSED" ? "secondary" : "premium"}>
          {TICKET_STATUS_LABELS[ticket.status]}
        </Badge>
      </div>
      <h1 className="text-2xl font-bold">{ticket.subject}</h1>

      <div className="space-y-4">
        {ticket.messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex gap-3 rounded-lg border p-4",
              msg.isInternal
                ? "border-amber-500/40 bg-amber-500/5"
                : msg.isStaff
                  ? "border-neon-blue/30 bg-neon-blue/5 ml-0 mr-8"
                  : "border-border/50 bg-card/40 mr-0 ml-8"
            )}
          >
            <UserAvatar
              src={msg.sender.avatarUrl}
              name={msg.sender.displayName ?? msg.sender.username}
              className="h-8 w-8 shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <span className="font-medium text-foreground">{formatDisplayName(msg.sender)}</span>
                {msg.isInternal && <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-600">Internal</Badge>}
                {msg.isStaff && !msg.isInternal && <Badge variant="outline" className="text-[10px]">Staff</Badge>}
                <span>{new Date(msg.createdAt).toLocaleString()}</span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
      </div>

      {canReply && ticket.status !== "CLOSED" && (
        <div className="glass rounded-xl p-4 space-y-3">
          <Textarea
            placeholder="Write your reply..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
          />
          <div className="flex gap-2">
            <Button variant="neon" onClick={sendReply} disabled={pending || !content.trim()}>
              Send Reply
            </Button>
            <Button variant="outline" onClick={handleClose} disabled={pending}>
              Close Ticket
            </Button>
          </div>
        </div>
      )}

      {isStaff && ticket.status !== "CLOSED" && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
          <p className="text-xs font-medium text-amber-600">Internal note (staff only)</p>
          <Textarea
            placeholder="Add an internal note visible only to staff..."
            value={internalNote}
            onChange={(e) => setInternalNote(e.target.value)}
            rows={3}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={sendInternalNote}
            disabled={pending || !internalNote.trim()}
          >
            Add internal note
          </Button>
        </div>
      )}

      {ticket.status === "CLOSED" && (
        <Button variant="outline" onClick={handleReopen} disabled={pending}>
          Reopen Ticket
        </Button>
      )}
    </div>
  );
}
