import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { resolveLoginRedirect } from "@/lib/auth-redirect";
import { LoginForm } from "./login-form";
import type { Locale } from "@/i18n/config";

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ redirect?: string; next?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (user && !user.isBanned) {
    redirect(resolveLoginRedirect(locale, sp, user));
  }

  return (
    <Suspense fallback={<div className="mx-auto max-w-md px-4 py-16 h-96 animate-pulse rounded-xl bg-muted/20" />}>
      <LoginForm />
    </Suspense>
  );
}
