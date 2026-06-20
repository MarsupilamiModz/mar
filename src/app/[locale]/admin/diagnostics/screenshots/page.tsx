import { getScreenshotDiagnostics } from "@/actions/admin/screenshot-diagnostics";
import { ScreenshotDiagnosticsPanel } from "@/components/admin/screenshot-diagnostics-panel";

export default async function ScreenshotDiagnosticsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const result = await getScreenshotDiagnostics(100);

  if (!result.success) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-sm">
        Unable to load screenshot diagnostics: {result.error}
      </div>
    );
  }

  return <ScreenshotDiagnosticsPanel locale={locale} initial={result.data} />;
}
