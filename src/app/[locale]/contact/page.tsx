"use client";

import { SITE } from "@/lib/site";
import { sendContactMessage } from "@/actions/contact";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useState, useTransition } from "react";

export default function ContactPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold text-gradient">Contact {SITE.name}</h1>
      <Card className="glass mt-8 p-6">
        {sent ? (
          <p className="text-sm text-neon-blue">Message sent. We&apos;ll respond within 48 hours.</p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              const fd = new FormData(e.currentTarget);
              startTransition(async () => {
                const result = await sendContactMessage({
                  name: fd.get("name") as string,
                  email: fd.get("email") as string,
                  message: fd.get("message") as string,
                });
                if (result.success) setSent(true);
                else setError(result.error);
              });
            }}
            className="space-y-4"
          >
            <Input name="name" placeholder="Name" required disabled={pending} />
            <Input name="email" type="email" placeholder="Email" required disabled={pending} />
            <textarea
              name="message"
              className="flex min-h-[120px] w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm"
              placeholder="Message"
              required
              disabled={pending}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button variant="neon" type="submit" className="w-full" disabled={pending}>
              {pending ? "Sending..." : "Send Message"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
