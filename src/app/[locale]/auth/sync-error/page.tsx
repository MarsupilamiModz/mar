import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { resolveLoginRedirect } from "@/lib/auth-redirect";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Locale } from "@/i18n/config";

export default async function AuthSyncErrorPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const user = await getCurrentUser();

  if (user && !user.isBanned) {
    redirect(resolveLoginRedirect(locale, sp, user));
  }

  const retryPath = sp.redirect?.startsWith("/") ? sp.redirect : `/${locale}/dashboard`;

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <Card className="glass p-8 space-y-4">
        <h1 className="text-xl font-bold">Account sync in progress</h1>
        <p className="text-sm text-muted-foreground">
          Your session is active, but we could not load your profile yet. This is usually temporary.
          Please try again in a few seconds.
        </p>
        <div className="flex flex-col gap-2">
          <Button variant="neon" asChild>
            <Link href={retryPath}>Try again</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/${locale}/login?redirect=${encodeURIComponent(retryPath)}`}>
              Return to login
            </Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
