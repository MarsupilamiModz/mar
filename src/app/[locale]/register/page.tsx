"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { sendRegistrationWelcomeEmail } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useState } from "react";

export default function RegisterPage() {
  const t = useTranslations("auth");
  const params = useParams();
  const locale = params.locale as string;
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/api/auth/callback?locale=${locale}&next=/${locale}/dashboard/settings` },
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    if (data.user && !data.session) {
      router.push(`/${locale}/login?verify=pending`);
      return;
    }
    void sendRegistrationWelcomeEmail(email);
    router.push(`/${locale}/dashboard`);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <Card className="glass p-8">
        <h1 className="text-2xl font-bold text-gradient">{t("register")}</h1>
        <form onSubmit={handleRegister} className="mt-6 space-y-4">
          <div>
            <label className="text-sm">{t("email")}</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1" />
          </div>
          <div>
            <label className="text-sm">{t("password")}</label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="mt-1" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button variant="neon" className="w-full" type="submit" disabled={loading}>
            {t("register")}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          <Link href={`/${locale}/login`}>{t("login")}</Link>
        </p>
      </Card>
    </div>
  );
}
