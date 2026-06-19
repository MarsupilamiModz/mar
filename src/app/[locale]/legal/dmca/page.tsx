import { DMCAPortalForm } from "@/components/trust/dmca-portal-form";
import type { Locale } from "@/i18n/config";

export default async function DMCAPage({ params }: { params: Promise<{ locale: Locale }> }) {
  await params;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">DMCA & Copyright Portal</h1>
        <p className="mt-2 text-muted-foreground">
          Rights holders can submit takedown notices for content that infringes copyright.
          All submissions are reviewed by our legal team and retained permanently.
        </p>
      </div>
      <DMCAPortalForm />
      <div className="text-xs text-muted-foreground space-y-2">
        <p>By submitting, you declare under penalty of perjury that you are authorized to act on behalf of the copyright owner.</p>
        <p>Workflow: Submitted → Legal Review → Accepted/Removed or Rejected.</p>
      </div>
    </div>
  );
}
