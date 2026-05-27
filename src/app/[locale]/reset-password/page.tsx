"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/brand/logo";
import { toast } from "@/hooks/use-toast";

export default function ResetPasswordPage() {
  const params = useParams();
  const locale = params.locale as string;
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="mb-8 flex justify-center"><Logo /></div>
      <Card className="glass p-8">
        <h1 className="text-2xl font-bold text-gradient">Set new password</h1>
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const supabase = createClient();
              const { error } = await supabase.auth.updateUser({ password });
              if (error) {
                toast({ title: "Error", description: error.message, variant: "destructive" });
                return;
              }
              toast({ title: "Password updated" });
              router.push(`/${locale}/login`);
            });
          }}
        >
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password"
            minLength={8}
            required
          />
          <Button variant="neon" type="submit" className="w-full" disabled={pending}>
            Update password
          </Button>
        </form>
      </Card>
    </div>
  );
}
