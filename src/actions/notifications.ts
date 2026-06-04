"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/db";
import { actionTry, ok, requireActionUser } from "@/lib/action-utils";
import {
  getUnreadNotificationCount,
  notifyUser,
  type CreateNotificationInput,
} from "@/lib/notifications-service";

export async function getNotifications(params?: { search?: string; category?: string; limit?: number }) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const limit = Math.min(params?.limit ?? 50, 100);
  const where = {
    userId: user.id,
    ...(params?.category && params.category !== "all" && { category: params.category }),
    ...(params?.search && {
      OR: [
        { title: { contains: params.search, mode: "insensitive" as const } },
        { body: { contains: params.search, mode: "insensitive" as const } },
      ],
    }),
  };

  return actionTry(
    () =>
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
    "notifications:list"
  );
}

export async function getUnreadNotificationsCount() {
  const { user, error } = await requireActionUser();
  if (error) return error;
  return ok(await getUnreadNotificationCount(user.id));
}

export async function markNotificationRead(id: string) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  await prisma.notification.updateMany({
    where: { id, userId: user.id },
    data: { read: true },
  });

  revalidateTag(`notifications-${user.id}`);
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

  revalidateTag(`notifications-${user.id}`);
  revalidatePath("/dashboard/notifications");
  return ok(undefined);
}

export async function deleteNotification(id: string) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  await prisma.notification.deleteMany({
    where: { id, userId: user.id },
  });

  revalidateTag(`notifications-${user.id}`);
  revalidatePath("/dashboard/notifications");
  return ok(undefined);
}

export async function createNotification(params: CreateNotificationInput) {
  await notifyUser(params);
}
