import { getAuthDiagnostics } from "@/actions/admin/diagnostics";
import { AdminDiagnosticsPanel } from "@/components/admin/admin-diagnostics-panel";

export default async function AdminDiagnosticsPage() {
  const result = await getAuthDiagnostics();
  if (!result.success) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-sm">
        Unable to load diagnostics: {result.error}
      </div>
    );
  }

  return <AdminDiagnosticsPanel data={result.data} />;
}
