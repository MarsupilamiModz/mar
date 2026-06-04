"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { TicketCategory } from "@prisma/client";
import { createTicket } from "@/actions/tickets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { TICKET_CATEGORY_LABELS, TICKET_DEPARTMENTS } from "@/lib/ticket-labels";

export function CreateTicketForm({ locale }: { locale: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [category, setCategory] = useState<TicketCategory>("GENERAL_SUPPORT");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await createTicket({
        subject: form.get("subject") as string,
        category,
        message: form.get("message") as string,
      });
      if (result.success) {
        toast({ title: "Ticket created", description: result.data.ticketNumber });
        router.push(`/${locale}/dashboard/support/${result.data.ticketId}`);
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      }
    });
  }

  return (
    <Card className="glass p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-medium">Category</label>
          <Select value={category} onValueChange={(v) => setCategory(v as TicketCategory)}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TICKET_DEPARTMENTS.map((c) => (
                <SelectItem key={c} value={c}>
                  {TICKET_CATEGORY_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium">Subject</label>
          <Input name="subject" required minLength={5} className="mt-1" placeholder="Brief summary" />
        </div>
        <div>
          <label className="text-sm font-medium">Message</label>
          <Textarea
            name="message"
            required
            minLength={10}
            rows={6}
            className="mt-1"
            placeholder="Describe your issue in detail..."
          />
        </div>
        <Button type="submit" variant="neon" disabled={pending} className="w-full">
          {pending ? "Creating..." : "Submit Ticket"}
        </Button>
      </form>
    </Card>
  );
}
