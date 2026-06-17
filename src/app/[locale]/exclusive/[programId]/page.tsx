import { notFound } from "next/navigation";
import { getPublicExclusiveProgram, getUserExclusiveApplication } from "@/actions/exclusive";
import { getCurrentUser } from "@/lib/auth";
import { ExclusiveApplyForm } from "@/components/exclusive/exclusive-apply-form";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { Locale } from "@/i18n/config";

export default async function PublicExclusivePage({
  params,
}: {
  params: Promise<{ locale: Locale; programId: string }>;
}) {
  const { locale, programId } = await params;

  const result = await getPublicExclusiveProgram(programId);
  if (!result.success) notFound();

  const user = await getCurrentUser();
  const appResult = user ? await getUserExclusiveApplication(programId) : null;
  const existingApplication = appResult?.success ? appResult.data : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 space-y-6">
      {!user ? (
        <div className="glass rounded-xl p-8 text-center space-y-4">
          <p className="text-muted-foreground">Sign in to apply for exclusive access.</p>
          <Button variant="neon" asChild>
            <Link href={`/${locale}/login?next=/${locale}/exclusive/${programId}`}>Sign in</Link>
          </Button>
        </div>
      ) : (
        <ExclusiveApplyForm program={result.data} existingApplication={existingApplication} />
      )}
    </div>
  );
}
