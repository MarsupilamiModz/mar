"use client";

import { SITE } from "@/lib/site";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useState } from "react";

export default function ContactPage() {
  const [sent, setSent] = useState(false);

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
              setSent(true);
            }}
            className="space-y-4"
          >
            <Input name="name" placeholder="Name" required />
            <Input name="email" type="email" placeholder="Email" required />
            <textarea
              name="message"
              className="flex min-h-[120px] w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm"
              placeholder="Message"
              required
            />
            <Button variant="neon" type="submit" className="w-full">
              Send Message
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
