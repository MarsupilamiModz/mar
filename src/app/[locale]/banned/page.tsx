import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { formatDate } from "@/lib/format-locale";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";

export default async function BannedPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const user = await getCurrentUser();

  const reason = user?.banReason ?? "Your account has been suspended for violating platform policies.";
  const expiresAt =
    (user as { banExpiresAt?: Date | null } | null)?.banExpiresAt ?? null;

  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center space-y-6">
      <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive text-2xl">
        !
      </div>
      <h1 className="text-2xl font-bold text-destructive">Account Suspended</h1>
      <p className="text-muted-foreground">
        Access to Xumari Modz has been restricted on this account.
      </p>

      <div className="glass rounded-xl border border-border/50 p-5 text-left space-y-3 text-sm">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Reason</p>
          <p className="mt-1">{reason}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Duration</p>
          <p className="mt-1">
            {expiresAt ? `Until ${formatDate(expiresAt, locale)}` : "Permanent"}
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button asChild variant="outline">
          <Link href={`/${locale}/support`}>Submit an appeal</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href={`/${locale}`}>Return home</Link>
        </Button>
      </div>
    </div>
  );
}
