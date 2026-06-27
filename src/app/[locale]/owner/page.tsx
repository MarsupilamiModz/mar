import { getOwnerControlCenterData } from "@/actions/admin/owner";
import { requireOwner } from "@/lib/auth";
import { OwnerControlCenter } from "@/components/admin/owner-control-center";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Locale } from "@/i18n/config";

export const dynamic = "force-dynamic";

export default async function OwnerPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  await requireOwner();

  const statsResult = await getOwnerControlCenterData();

  return (
    <div className="container py-8 space-y-8">
      <div>
        <Badge className="mb-2 bg-neon-purple/20 text-neon-purple border-neon-purple/40">
          Owner only
        </Badge>
        <h1 className="text-2xl font-bold">Owner Panel</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Platform control, Discord import, and enterprise analytics.
        </p>
        <div className="flex flex-wrap gap-2 mt-4">
          <Button variant="neon" asChild>
            <Link href={`/${locale}/owner/discord-import`}>Discord Import Center</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/${locale}/admin/owner`}>Control Center</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/${locale}/admin/owner/health`}>System Health</Link>
          </Button>
        </div>
      </div>

      {statsResult.success ? <OwnerControlCenter data={statsResult.data} /> : null}
    </div>
  );
}
