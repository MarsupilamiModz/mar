import { prisma } from "@/lib/db";
import type { TutorialLevel, TutorialType } from "@prisma/client";

export async function listPublishedTutorials(filters?: {
  categorySlug?: string;
  level?: TutorialLevel;
  type?: TutorialType;
  q?: string;
  take?: number;
}) {
  return prisma.tutorial.findMany({
    where: {
      status: "PUBLISHED",
      ...(filters?.categorySlug
        ? { category: { slug: filters.categorySlug } }
        : {}),
      ...(filters?.level ? { level: filters.level } : {}),
      ...(filters?.type ? { type: filters.type } : {}),
      ...(filters?.q
        ? {
            OR: [
              { title: { contains: filters.q, mode: "insensitive" } },
              { description: { contains: filters.q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      category: { select: { slug: true, name: true } },
      author: { select: { username: true, displayName: true, avatarUrl: true } },
    },
    orderBy: [{ publishedAt: "desc" }, { viewCount: "desc" }],
    take: filters?.take ?? 48,
  });
}

export async function getTutorialBySlug(slug: string) {
  return prisma.tutorial.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: {
      category: true,
      author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      comments: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          user: { select: { username: true, displayName: true, avatarUrl: true } },
        },
      },
    },
  });
}

export async function listTutorialCategories() {
  return prisma.tutorialCategory.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: {
      _count: { select: { tutorials: { where: { status: "PUBLISHED" } } } },
    },
  });
}

export async function incrementTutorialView(tutorialId: string, userId?: string, watchSec = 0) {
  await prisma.$transaction([
    prisma.tutorial.update({
      where: { id: tutorialId },
      data: { viewCount: { increment: 1 } },
    }),
    prisma.tutorialView.create({
      data: { tutorialId, userId, watchSec },
    }),
  ]);
}
