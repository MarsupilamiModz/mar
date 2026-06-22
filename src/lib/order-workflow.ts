import type { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import {
  notifyOrderUpdate,
  notifyStaffNewShopOrder,
} from "@/lib/notifications-service";
import { sendOrderStatusEmail, sendOrderMessageEmail, sendCustomOrderNotification } from "@/lib/email/send";
import { ORDER_STATUS_LABELS } from "@/lib/shop-enterprise";
import { postTeamChannelAlert } from "@/lib/team-chat-system";
import { getAppUrl } from "@/lib/app-url";

export async function logOrderActivity(
  orderId: string,
  action: string,
  actorId?: string,
  details?: Record<string, unknown>
) {
  await prisma.orderActivity.create({
    data: {
      orderId,
      actorId,
      action,
      details: details as object | undefined,
    },
  });
}

export async function notifyOrderStakeholders(params: {
  orderId: string;
  title: string;
  body: string;
  locale?: string;
  clientId: string;
  assigneeId?: string | null;
  emailTemplate?: "status" | "assigned" | "completed" | "revision";
}) {
  const loc = params.locale ?? "en";

  await notifyOrderUpdate({
    userId: params.clientId,
    title: params.title,
    body: params.body,
    orderId: params.orderId,
    locale: loc,
  });

  if (params.assigneeId) {
    await notifyOrderUpdate({
      userId: params.assigneeId,
      title: params.title,
      body: params.body,
      orderId: params.orderId,
      locale: loc,
    });
  }

  void sendOrderStatusEmail({
    orderId: params.orderId,
    title: params.title,
    body: params.body,
    template: params.emailTemplate ?? "status",
  }).catch(() => undefined);
}

export async function notifyStaffNewCustomOrder(orderId: string, locale = "en") {
  const order = await prisma.customOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      title: true,
      client: { select: { username: true, email: true, displayName: true, discordUsername: true } },
      attachments: { select: { fileName: true } },
    },
  });
  if (!order) return;

  await notifyStaffNewShopOrder({
    orderId: order.id,
    title: order.title,
    clientUsername: order.client.username,
    locale,
  });

  void sendCustomOrderNotification({
    id: order.id,
    title: order.title,
    description: "",
    client: order.client,
    attachments: order.attachments,
  } as Parameters<typeof sendCustomOrderNotification>[0]).catch(() => undefined);

  const link = `${getAppUrl()}/${locale}/admin/orders/${orderId}`;
  void postTeamChannelAlert({
    channelSlug: "designers",
    content: `🛒 **New Custom Order Received**\n${order.title} by @${order.client.username}\n${link}`,
  }).catch(() => undefined);
}

export async function onNewShopOrder(orderId: string, locale = "en") {
  const order = await prisma.customOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      title: true,
      clientId: true,
      assigneeId: true,
      requirementsSubmittedAt: true,
      paymentStatus: true,
      client: { select: { email: true, username: true } },
    },
  });
  if (!order) return;

  // Paid shop orders notify staff only after requirements are submitted.
  if (order.paymentStatus === "PAID" && !order.requirementsSubmittedAt) return;

  await logOrderActivity(orderId, "order.created", undefined, { source: "shop" });
  await notifyStaffNewCustomOrder(orderId, locale);

  await notifyOrderStakeholders({
    orderId: order.id,
    title: "Order received",
    body: `Your order "${order.title}" has been received and is in review.`,
    clientId: order.clientId,
    assigneeId: order.assigneeId,
    locale,
    emailTemplate: "status",
  });
}

export async function onOrderRequirementsSubmitted(orderId: string, locale = "en") {
  await prisma.customOrder.update({
    where: { id: orderId },
    data: { requirementsSubmittedAt: new Date(), status: "IN_REVIEW" },
  });

  await logOrderActivity(orderId, "requirements.submitted", undefined);
  await notifyStaffNewCustomOrder(orderId, locale);

  const order = await prisma.customOrder.findUnique({
    where: { id: orderId },
    select: { id: true, title: true, clientId: true, assigneeId: true },
  });
  if (!order) return;

  await notifyOrderStakeholders({
    orderId: order.id,
    title: "Requirements submitted",
    body: `Your project details for "${order.title}" were received. Our team will review them shortly.`,
    clientId: order.clientId,
    assigneeId: order.assigneeId,
    locale,
    emailTemplate: "status",
  });
}

export async function onOrderPaid(orderId: string, locale = "en") {
  const order = await prisma.customOrder.findUnique({
    where: { id: orderId },
    select: { id: true, title: true, clientId: true, requirementsSubmittedAt: true },
  });
  if (!order) return;

  await logOrderActivity(orderId, "payment.received", undefined);

  await notifyOrderUpdate({
    userId: order.clientId,
    title: "Payment confirmed",
    body: `Complete your project details for "${order.title}".`,
    orderId: order.id,
    locale,
  });

  if (order.requirementsSubmittedAt) {
    await onNewShopOrder(orderId, locale);
  }
}

export async function transitionOrderStatus(params: {
  orderId: string;
  status: OrderStatus;
  actorId: string;
  assigneeId?: string | null;
  internalNote?: string;
  locale?: string;
}) {
  const order = await prisma.customOrder.update({
    where: { id: params.orderId },
    data: {
      status: params.status,
      ...(params.assigneeId !== undefined && { assigneeId: params.assigneeId }),
      ...(params.internalNote && { internalNotes: params.internalNote }),
      ...(params.status === "COMPLETED" && { completedAt: new Date() }),
      ...(params.status === "DELIVERED" && { deliveredAt: new Date() }),
    },
    select: { id: true, title: true, clientId: true, assigneeId: true, status: true },
  });

  await logOrderActivity(params.orderId, "status.changed", params.actorId, {
    status: params.status,
    assigneeId: params.assigneeId,
  });

  await createAuditLog({
    actorId: params.actorId,
    action: "order.status_update",
    entityType: "CustomOrder",
    entityId: params.orderId,
    metadata: { status: params.status },
  });

  const label = ORDER_STATUS_LABELS[params.status] ?? params.status;
  await notifyOrderStakeholders({
    orderId: order.id,
    title: `Order ${label}`,
    body: `Order "${order.title}" is now ${label}.`,
    clientId: order.clientId,
    assigneeId: order.assigneeId,
    locale: params.locale,
    emailTemplate: params.status === "COMPLETED" ? "completed" : params.status === "REVISION_REQUESTED" ? "revision" : "status",
  });

  return order;
}

export async function onOrderMessageSent(params: {
  orderId: string;
  senderId: string;
  clientId: string;
  assigneeId?: string | null;
  isInternal: boolean;
  content: string;
  locale?: string;
}) {
  if (params.isInternal) return;

  const recipientId =
    params.senderId === params.clientId ? params.assigneeId : params.clientId;
  if (!recipientId) return;

  await notifyOrderUpdate({
    userId: recipientId,
    title: "New order message",
    body: params.content.slice(0, 120),
    orderId: params.orderId,
    locale: params.locale,
  });

  void sendOrderMessageEmail({
    orderId: params.orderId,
    preview: params.content.slice(0, 200),
  }).catch(() => undefined);
}
