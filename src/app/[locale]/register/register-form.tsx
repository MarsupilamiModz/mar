"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { registerUser, validateReferralCode } from "@/actions/register";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { AuthLanguagePicker } from "@/components/auth/auth-language-picker";
import { TurnstileWidget, getDeviceFingerprint, isTurnstileConfigured } from "@/components/auth/turnstile-widget";
import { AuthLogo } from "@/components/auth/auth-page-shell";
import type { AuthBrandingSettings } from "@/lib/auth-branding";
import { useEffect, useState } from "react";
import { normalizeReferralCode } from "@/lib/referral-cookie";

export function RegisterForm({ authBranding }: { authBranding?: AuthBrandingSettings }) {
  const t = useTranslations("auth");
  const params = useParams();
  const searchParams = useSearchParams();
  const locale = params.locale as string;
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [promoHint, setPromoHint] = useState<string | null>(null);
  const [promoValidating, setPromoValidating] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRequired = isTurnstileConfigured();

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref?.trim()) {
      setPromoCode(normalizeReferralCode(ref));
    }
  }, [searchParams]);

  async function checkPromoCode(code: string) {
    const normalized = normalizeReferralCode(code);
    if (!normalized) {
      setPromoHint(null);
      return;
    }
    setPromoValidating(true);
    const result = await validateReferralCode(normalized);
    setPromoValidating(false);
    if (result.success) {
      setPromoHint(
        t("promoCodeValid", {
          days: result.data.premiumDays,
          tier: result.data.premiumType.replace("_", " "),
        })
      );
    } else {
      setPromoHint(t("promoCodeInvalid"));
    }
  }

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
      promoCode: promoCode.trim() || undefined,
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
      {authBranding ? <AuthLogo branding={authBranding} variant="register" /> : null}
      <Card className="glass p-8">
        <h1 className="text-2xl font-bold text-gradient">{authBranding?.registerTitle ?? t("register")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {authBranding?.registerDescription ?? t("registerSubtitle")}
        </p>
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
          <div>
            <label className="text-sm">{t("promoCode")}</label>
            <Input
              value={promoCode}
              onChange={(e) => {
                setPromoCode(e.target.value.toUpperCase());
                setPromoHint(null);
              }}
              onBlur={(e) => void checkPromoCode(e.target.value)}
              placeholder={t("promoCodePlaceholder")}
              className="mt-1 font-mono uppercase tracking-wider"
              autoComplete="off"
            />
            {promoValidating && (
              <p className="mt-1 text-xs text-muted-foreground">{t("promoCodeChecking")}</p>
            )}
            {promoHint && !promoValidating && (
              <p className={`mt-1 text-xs ${promoHint === t("promoCodeInvalid") ? "text-destructive" : "text-emerald-400"}`}>
                {promoHint}
              </p>
            )}
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
          {authBranding?.discordButtonText ?? t("discord")}
        </Button>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          <Link href={`/${locale}/login`}>{t("login")}</Link>
        </p>
      </Card>
    </div>
  );
}
