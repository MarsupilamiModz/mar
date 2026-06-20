import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { getCreatorExclusivePrograms } from "@/actions/exclusive";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Locale } from "@/i18n/config";

export default async function CreatorExclusivePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;

  await requireAuth(`/${locale}/creator/exclusive`);
  const result = await getCreatorExclusivePrograms();
  const programs = result.success ? result.data : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Exclusive Access Hub</h2>
          <p className="text-sm text-muted-foreground">Closed alpha, beta, and invite-only releases.</p>
        </div>
        <Button variant="neon" asChild>
          <Link href={`/${locale}/creator/exclusive/new`}>Launch program</Link>
        </Button>
      </div>

      {programs.length === 0 ? (
        <Card className="glass p-8 text-center text-muted-foreground">
          No exclusive programs yet. Create one from a mod to start closed alpha or beta testing.
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {programs.map((p) => (
            <Link key={p.id} href={`/${locale}/creator/exclusive/${p.id}`}>
              <Card className="glass p-5 space-y-2 hover:border-neon-purple/40 transition-colors h-full">
                <div className="flex items-center justify-between">
                  <Badge variant="premium">{p.type.replace("_", " ")}</Badge>
                  <Badge variant={p.isActive ? "free" : "outline"}>{p.isActive ? "Active" : "Inactive"}</Badge>
                </div>
                <h3 className="font-semibold">{p.title}</h3>
                <p className="text-sm text-muted-foreground">{p.mod.title}</p>
                <p className="text-xs text-muted-foreground">
                  {p._count.applications} applications · {p._count.builds} builds
                  {p.maxSlots != null && ` · ${p.currentCount}/${p.maxSlots} slots`}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
