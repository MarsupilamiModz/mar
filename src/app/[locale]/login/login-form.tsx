"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/brand/logo";
import { useState } from "react";

export function LoginForm() {
  const t = useTranslations("auth");
  const params = useParams();
  const locale = params.locale as string;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.push(searchParams.get("redirect") ?? `/${locale}/dashboard`);
    router.refresh();
  }

  async function loginWithDiscord() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: {
        redirectTo: `${window.location.origin}/${locale}/dashboard`,
      },
    });
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="mb-8 flex justify-center"><Logo /></div>
      <Card className="glass p-8">
        <h1 className="text-2xl font-bold text-gradient">{t("login")}</h1>
        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <div>
            <label className="text-sm">{t("email")}</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1" />
          </div>
          <div>
            <div className="flex justify-between">
              <label className="text-sm">{t("password")}</label>
              <Link href={`/${locale}/forgot-password`} className="text-xs text-neon-purple hover:underline">
                {t("forgot")}
              </Link>
            </div>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="mt-1" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button variant="neon" className="w-full" type="submit" disabled={loading}>
            {t("login")}
          </Button>
        </form>
        <Button variant="outline" className="w-full mt-4" onClick={loginWithDiscord}>
          {t("discord")}
        </Button>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          <Link href={`/${locale}/register`} className="text-neon-purple hover:underline">Create account</Link>
        </p>
      </Card>
    </div>
  );
}
