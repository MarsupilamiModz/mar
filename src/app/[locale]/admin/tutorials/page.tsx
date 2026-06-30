import { getTutorialsAdminData } from "@/actions/admin/tutorials";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TutorialsAdminPanel } from "@/components/admin/tutorials-admin-panel";

export const dynamic = "force-dynamic";

export default async function AdminTutorialsPage() {
  const user = await getCurrentUser();
  if (!user || !["OWNER", "ADMIN", "CREATOR"].includes(user.role)) {
    redirect("/login");
  }
  const result = await getTutorialsAdminData();
  if (!result.success) return <p className="text-destructive">{result.error}</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tutorial Center</h1>
        <p className="text-sm text-muted-foreground mt-1">YouTube, Video, Artikel — Kategorien & Analytics.</p>
      </div>
      <TutorialsAdminPanel data={result.data} />
    </div>
  );
}
