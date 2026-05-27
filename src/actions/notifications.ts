"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { ok, requireActionUser } from "@/lib/action-utils";

export async function getNotifications() {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return ok(notifications);
}

export async function markNotificationRead(id: string) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  await prisma.notification.updateMany({
    where: { id, userId: user.id },
    data: { read: true },
  });

  revalidatePath("/dashboard/notifications");
  return ok(undefined);
}

export async function markAllNotificationsRead() {
  const { user, error } = await requireActionUser();
  if (error) return error;

  await prisma.notification.updateMany({
    where: { userId: user.id, read: false },
    data: { read: true },
  });

  revalidatePath("/dashboard/notifications");
  return ok(undefined);
}

export async function createNotification(params: {
  userId: string;
  title: string;
  body: string;
  link?: string;
}) {
  await prisma.notification.create({ data: params });
}
