"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, ok, requireActionPermission } from "@/lib/action-utils";

const schema = z.object({
  title: z.string().min(2).max(120),
  content: z.string().min(2).max(5000),
  link: z.string().url().optional().or(z.literal("")),
  isActive: z.boolean(),
  endsAt: z.string().optional(),
});

export async function getActiveAnnouncements() {
  const now = new Date();
  const items = await prisma.announcement.findMany({
    where: {
      isActive: true,
      startsAt: { lte: now },
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
    },
    orderBy: { createdAt: "desc" },
    take: 3,
  });
  return items;
}

export async function listAnnouncements() {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;
  const items = await prisma.announcement.findMany({ orderBy: { createdAt: "desc" } });
  return ok(items);
}

export async function createAnnouncement(input: z.infer<typeof schema>) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;
  const parsed = schema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.message);

  const item = await prisma.announcement.create({
    data: {
      title: parsed.data.title,
      content: parsed.data.content,
      link: parsed.data.link || null,
      isActive: parsed.data.isActive,
      endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
    },
  });
  revalidatePath("/");
  return ok(item);
}

export async function toggleAnnouncement(id: string, isActive: boolean) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;
  await prisma.announcement.update({ where: { id }, data: { isActive } });
  revalidatePath("/");
  return ok(undefined);
}

export async function deleteAnnouncement(id: string) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;
  await prisma.announcement.delete({ where: { id } });
  revalidatePath("/");
  return ok(undefined);
}
