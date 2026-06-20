import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { setRequestLocale } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Locale } from "@/i18n/config";

export const dynamic = "force-dynamic";

export default async function CreatorCollectionsPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;

  setRequestLocale(locale);
  const user = await requireAuth(`/${locale}/creator/collections`);

  const collections = await prisma.modCollection.findMany({
    where: { ownerId: user.id },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { items: true, followers: true } } },
  }).catch(() => []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">My collections</h2>
        <Button variant="neon" asChild>
          <Link href={`/${locale}/creator/collections/new`}>New collection</Link>
        </Button>
      </div>

      {collections.length === 0 ? (
        <Card className="glass p-6 text-sm text-muted-foreground">
          No collections yet. Create a modpack or curated list for your audience.
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {collections.map((c) => (
            <Link key={c.id} href={`/${locale}/creator/collections/${c.id}`}>
              <Card className="glass h-full hover:border-neon-purple/30 transition-colors">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{c.title}</CardTitle>
                    {c.isFeatured && <Badge>Featured</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {c._count.items} mods · {c._count.followers} followers · {c.visibility}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
