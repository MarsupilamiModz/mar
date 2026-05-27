import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { formatDisplayName } from "@/lib/display-name";
import type { Locale } from "@/i18n/config";

export default async function BlogPage({ params: { locale } }: { params: { locale: Locale } }) {
  const posts = await prisma.blogPost
    .findMany({
      where: { published: true },
      orderBy: { publishedAt: "desc" },
      take: 20,
      include: { author: { select: { username: true, displayName: true } } },
    })
    .catch(() => []);

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold text-gradient">News & Updates</h1>
      <div className="mt-10 space-y-4">
        {posts.length === 0 ? (
          <p className="text-muted-foreground">No posts yet. Check back soon.</p>
        ) : (
          posts.map((p) => (
            <Link key={p.id} href={`/${locale}/blog/${p.slug}`}>
              <Card className="glass p-6 hover:border-neon-purple/40">
                <h2 className="font-semibold text-lg">{p.title}</h2>
                <p className="text-sm text-muted-foreground mt-1">{p.excerpt}</p>
                <p className="text-xs text-neon-blue mt-2">{formatDisplayName(p.author)}</p>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
