import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { resolveLoginRedirect } from "@/lib/auth-redirect";
import { ReferralCapture } from "@/components/referral/referral-capture";
import { RegisterForm } from "./register-form";
import type { Locale } from "@/i18n/config";

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (user && !user.isBanned) {
    redirect(resolveLoginRedirect(locale, {}, user));
  }

  return (
    <Suspense fallback={<div className="mx-auto max-w-md px-4 py-16 h-96 animate-pulse rounded-xl bg-muted/20" />}>
      <ReferralCapture />
      <RegisterForm />
    </Suspense>
  );
}
