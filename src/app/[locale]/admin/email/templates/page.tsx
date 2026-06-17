import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePagePermission } from "@/lib/auth";
import { getAdminEmailTemplates } from "@/actions/admin/email";
import { EmailTemplatesPanel } from "@/components/admin/email-templates-panel";
import type { Locale } from "@/i18n/config";

export default async function AdminEmailTemplatesPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;

  await requirePagePermission("settings.write");
  const result = await getAdminEmailTemplates();
  const templates = result.success ? result.data : [];

  return (
    <div className="space-y-4">
      <Link href={`/${locale}/admin/email`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to email settings
      </Link>
      <h1 className="text-2xl font-bold">Email Templates</h1>
      {!result.success && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {result.error}
        </div>
      )}
      <EmailTemplatesPanel templates={templates} />
    </div>
  );
}
