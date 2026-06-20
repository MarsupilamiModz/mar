import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { setRequestLocale } from "next-intl/server";
import { CollectionEditForm } from "@/components/creator/collection-editor";
import type { Locale } from "@/i18n/config";

export const dynamic = "force-dynamic";

export default async function EditCollectionPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;

  setRequestLocale(locale);
  const user = await requireAuth(`/${locale}/creator/collections/${id}`);

  const collection = await prisma.modCollection.findUnique({
    where: { id },
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
        include: { mod: { select: { id: true, slug: true, title: true } } },
      },
    },
  }).catch(() => null);

  if (!collection || collection.ownerId !== user.id) notFound();

  return <CollectionEditForm locale={locale} collection={collection} />;
}
