import { NotificationType } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";

export type CreateNotificationInput = {
  userId: string;
  type?: NotificationType;
  category?: string;
  title: string;
  body: string;
  link?: string;
  metadata?: Record<string, unknown>;
};

export async function notifyUser(input: CreateNotificationInput) {
  const row = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type ?? "SYSTEM",
      category: input.category,
      title: input.title,
      body: input.body,
      link: input.link,
      metadata: input.metadata as object | undefined,
    },
  });
  const { revalidateTag } = await import("next/cache");
  revalidateTag(`notifications-${input.userId}`);
  return row;
}

export async function getUnreadNotificationCount(userId: string) {
  return unstable_cache(
    () =>
      prisma.notification.count({
        where: { userId, read: false },
      }),
    ["unread-notifications", userId],
    { revalidate: 15, tags: [`notifications-${userId}`] }
  )();
}

export async function notifyTicketReply(params: {
  userId: string;
  ticketNumber: string;
  subject: string;
  ticketId: string;
  locale?: string;
}) {
  const loc = params.locale ?? "en";
  return notifyUser({
    userId: params.userId,
    type: "TICKET_REPLY",
    category: "support",
    title: `Reply on ticket ${params.ticketNumber}`,
    body: params.subject,
    link: `/${loc}/dashboard/support/${params.ticketId}`,
    metadata: { ticketId: params.ticketId, ticketNumber: params.ticketNumber },
  });
}

export async function notifyOrderUpdate(params: {
  userId: string;
  title: string;
  body: string;
  orderId: string;
  locale?: string;
}) {
  const loc = params.locale ?? "en";
  return notifyUser({
    userId: params.userId,
    type: "ORDER_UPDATE",
    category: "orders",
    title: params.title,
    body: params.body,
    link: `/${loc}/dashboard/orders/${params.orderId}`,
    metadata: { orderId: params.orderId },
  });
}

export async function notifyPremiumActivated(userId: string, locale = "en") {
  return notifyUser({
    userId,
    type: "PREMIUM_ACTIVATED",
    category: "premium",
    title: "Premium activated",
    body: "Your Premium access is now active.",
    link: `/${locale}/premium`,
  });
}

export async function notifyStaffPartnerApplication(params: {
  applicationId: string;
  applicantName: string;
  username: string;
}) {
  const staff = await prisma.user.findMany({
    where: {
      deletedAt: null,
      isBanned: false,
      role: { in: ["OWNER", "ADMIN", "MODERATOR"] },
    },
    select: { id: true },
  });

  await Promise.all(
    staff.map((s) =>
      notifyUser({
        userId: s.id,
        type: "SYSTEM",
        category: "applications",
        title: "New partner application",
        body: `${params.applicantName} (@${params.username}) submitted a partner application.`,
        link: "/en/admin/applications",
        metadata: { applicationId: params.applicationId, kind: "partner" },
      })
    )
  );
}
