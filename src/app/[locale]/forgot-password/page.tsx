"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, useTransition } from "react";
import { requestPasswordReset } from "@/actions/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/brand/logo";
import { toast } from "@/hooks/use-toast";

export default function ForgotPasswordPage() {
  const params = useParams();
  const locale = params.locale as string;
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="mb-8 flex justify-center"><Logo /></div>
      <Card className="glass p-8">
        <h1 className="text-2xl font-bold text-gradient">Reset password</h1>
        {sent ? (
          <p className="mt-4 text-sm text-muted-foreground">
            If an account exists for {email}, you will receive a reset link shortly.
          </p>
        ) : (
          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              startTransition(async () => {
                const r = await requestPasswordReset(email, locale);
                if (r.success) {
                  setSent(true);
                  toast({ title: "Email sent" });
                } else toast({ title: "Error", description: r.error, variant: "destructive" });
              });
            }}
          >
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required />
            <Button variant="neon" type="submit" className="w-full" disabled={pending}>
              Send reset link
            </Button>
          </form>
        )}
        <p className="mt-4 text-center text-sm">
          <Link href={`/${locale}/login`} className="text-neon-purple hover:underline">Back to login</Link>
        </p>
      </Card>
    </div>
  );
}
