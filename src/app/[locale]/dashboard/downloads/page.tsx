import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import type { Locale } from "@/i18n/config";

export default async function DownloadsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;

  const user = await requireAuth(`/${locale}/dashboard/downloads`);

  const downloads = await prisma.download.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      mod: { select: { slug: true, title: true } },
      version: { select: { version: true } },
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold">Downloads</h1>
      <div className="mt-8 space-y-2">
        {downloads.length === 0 ? (
          <Card className="glass p-8 text-center text-muted-foreground">No downloads yet</Card>
        ) : (
          downloads.map((d) => (
            <Card key={d.id} className="glass p-4 flex justify-between items-center">
              <div>
                <Link href={`/${locale}/mods/${d.mod.slug}`} className="font-medium hover:text-neon-purple">
                  {d.mod.title}
                </Link>
                <p className="text-xs text-muted-foreground">v{d.version.version}</p>
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(d.createdAt).toLocaleString()}
              </span>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
