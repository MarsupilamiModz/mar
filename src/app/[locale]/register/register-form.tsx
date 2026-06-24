"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { registerUser } from "@/actions/register";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { AuthLanguagePicker } from "@/components/auth/auth-language-picker";
import { TurnstileWidget, getDeviceFingerprint, isTurnstileConfigured } from "@/components/auth/turnstile-widget";
import { useState } from "react";

export function RegisterForm() {
  const t = useTranslations("auth");
  const params = useParams();
  const locale = params.locale as string;
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRequired = isTurnstileConfigured();

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = e.currentTarget;
    const website = (form.elements.namedItem("website") as HTMLInputElement | null)?.value ?? "";

    const result = await registerUser({
      email,
      password,
      locale: locale as "en" | "de" | "fr" | "es" | "tr" | "pl",
      turnstileToken: turnstileToken || undefined,
      website,
      fingerprint: getDeviceFingerprint(),
    });

    setLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    router.push(`/${locale}/login?verify=pending`);
  }

  async function registerWithDiscord() {
    setLoading(true);
    setError("");
    const supabase = createClient();
    const callbackUrl = new URL("/api/auth/callback", window.location.origin);
    callbackUrl.searchParams.set("next", `/${locale}/dashboard`);
    callbackUrl.searchParams.set("locale", locale);

    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: { redirectTo: callbackUrl.toString() },
    });
    if (err) {
      setError(t("errors.generic"));
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <AuthLanguagePicker locale={locale} />
      <Card className="glass p-8">
        <h1 className="text-2xl font-bold text-gradient">{t("register")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("registerSubtitle")}</p>
        <form onSubmit={handleRegister} className="mt-6 space-y-4">
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            className="hidden"
            aria-hidden
          />
          <div>
            <label className="text-sm">{t("email")}</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1" />
          </div>
          <div>
            <label className="text-sm">{t("password")}</label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="mt-1" />
          </div>
          {turnstileRequired && (
            <TurnstileWidget
              onToken={setTurnstileToken}
              onExpire={() => setTurnstileToken("")}
            />
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            variant="neon"
            className="w-full"
            type="submit"
            disabled={loading || (turnstileRequired && !turnstileToken)}
          >
            {t("register")}
          </Button>
        </form>
        <Button variant="outline" className="w-full mt-4" onClick={registerWithDiscord} disabled={loading}>
          {t("discord")}
        </Button>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          <Link href={`/${locale}/login`}>{t("login")}</Link>
        </p>
      </Card>
    </div>
  );
}
