"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { fail, ok, requireActionPermission, requireActionUser, requireAnyActionPermission } from "@/lib/action-utils";
import { customOrderSchema } from "@/lib/validations";
import { hasPermission } from "@/lib/permissions";
import { logToDiscordWebhook } from "@/lib/discord";
import { rateLimit } from "@/lib/rate-limit";
import { generateInvoiceNumber, formatPaymentReference } from "@/lib/invoices";
import { sendCustomOrderNotification } from "@/lib/email";
import { createOrderPaymentCheckout } from "@/lib/stripe";
import { getPaymentSettings } from "@/lib/payments/settings";
import { assertStripeConfigured, formatStripeError } from "@/lib/stripe-config";
import { uploadAsset } from "@/lib/asset-storage";
import { formatDisplayName } from "@/lib/display-name";
import type { OrderPaymentMethod, OrderStatus } from "@prisma/client";
import { transitionOrderStatus, onOrderMessageSent, logOrderActivity, onOrderRequirementsSubmitted } from "@/lib/order-workflow";
import { userHasPermission } from "@/lib/permission-store";

export async function createCustomOrder(input: {
  title: string;
  description: string;
  orderType: string;
  budgetCents?: number;
  discordUsername?: string;
}) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const limit = rateLimit(`order:${user.id}`, 3, 3600_000);
  if (!limit.success) return fail("Rate limited");

  const parsed = customOrderSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.message);

  const invoiceNumber = await generateInvoiceNumber();

  const order = await prisma.customOrder.create({
    data: {
      clientId: user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      orderType: parsed.data.orderType,
      budgetCents: parsed.data.budgetCents,
      invoiceNumber,
      customerEmail: user.email,
      discordUsername: input.discordUsername ?? user.discordUsername,
      requirementsSubmittedAt: new Date(),
      messages: {
        create: {
          senderId: user.id,
          content: parsed.data.description,
        },
      },
    },
    include: {
      client: {
        select: {
          username: true,
          email: true,
          displayName: true,
          discordUsername: true,
        },
      },
      attachments: { select: { fileName: true } },
    },
  });

  const displayName = formatDisplayName(order.client);

  await Promise.all([
    logToDiscordWebhook({
      title: "New Custom Order",
      description: `**${parsed.data.title}** by ${displayName}\nInvoice: ${invoiceNumber}`,
    }),
    sendCustomOrderNotification(order),
  ]);

  revalidatePath("/dashboard/orders");
  return ok({ id: order.id, invoiceNumber });
}

const MAX_REFERENCE_FILES = 5;
const MAX_REFERENCE_BYTES = 15 * 1024 * 1024;

export async function createCustomOrderFromForm(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const orderType = String(formData.get("orderType") ?? "").trim();
  const budgetRaw = formData.get("budget");
  const discordUsername = String(formData.get("discord") ?? "").trim() || undefined;
  const budgetCents = budgetRaw && String(budgetRaw).length > 0 ? Number(budgetRaw) : undefined;

  const result = await createCustomOrder({
    title,
    description,
    orderType,
    budgetCents: Number.isFinite(budgetCents) ? budgetCents : undefined,
    discordUsername,
  });
  if (!result.success) return result;

  const files = formData.getAll("references").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return result;

  if (files.length > MAX_REFERENCE_FILES) return fail(`Maximum ${MAX_REFERENCE_FILES} reference files`);

  const attachments: { fileName: string }[] = [];
  for (const file of files) {
    if (file.size > MAX_REFERENCE_BYTES) return fail(`${file.name} exceeds 15MB limit`);

    const buffer = Buffer.from(await file.arrayBuffer());
    const safeName = file.name.replace(/[^\w.-]/g, "_");
    const key = `orders/${result.data.id}/refs/${Date.now()}-${safeName}`;
    const uploaded = await uploadAsset({
      bucket: "tickets",
      relativePath: key,
      body: buffer,
      contentType: file.type || "application/octet-stream",
    });

    await prisma.orderAttachment.create({
      data: {
        orderId: result.data.id,
        fileKey: uploaded.key,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
      },
    });
    attachments.push({ fileName: file.name });
  }

  if (attachments.length > 0) {
    const order = await prisma.customOrder.findUnique({
      where: { id: result.data.id },
      include: {
        client: {
          select: {
            username: true,
            email: true,
            displayName: true,
            discordUsername: true,
          },
        },
        attachments: { select: { fileName: true } },
      },
    });
    if (order) void sendCustomOrderNotification(order);
  }

  return result;
}

export async function quoteCustomOrder(orderId: string, amountCents: number, note?: string) {
  const { error } = await requireActionPermission("orders.write");
  if (error) return error;

  const order = await prisma.customOrder.update({
    where: { id: orderId },
    data: {
      quotedAmountCents: amountCents,
      finalAmountCents: amountCents,
      paymentStatus: "AWAITING_PAYMENT",
      status: "QUOTED",
      paymentNote: note ?? undefined,
      paymentReference: formatPaymentReference(
        (await prisma.customOrder.findUnique({ where: { id: orderId }, select: { invoiceNumber: true } }))?.invoiceNumber ?? orderId
      ),
    },
    select: { id: true, title: true, clientId: true },
  });

  const { notifyOrderUpdate } = await import("@/lib/notifications-service");
  await notifyOrderUpdate({
    userId: order.clientId,
    title: "Quote ready",
    body: `Your order "${order.title}" has been quoted. Review and pay from your order page.`,
    orderId: order.id,
  });

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath(`/dashboard/orders/${orderId}`);
  return ok(order);
}

export async function uploadOrderDelivery(orderId: string, formData: FormData) {
  const { error } = await requireActionPermission("orders.write");
  if (error) return error;

  const file = formData.get("file");
  if (!(file instanceof File)) return fail("No file");

  const buffer = Buffer.from(await file.arrayBuffer());
  const key = `orders/${orderId}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
  const uploaded = await uploadAsset({
    bucket: "tickets",
    relativePath: key,
    body: buffer,
    contentType: file.type || "application/octet-stream",
  });

  await prisma.customOrder.update({
    where: { id: orderId },
    data: {
      deliveryFileKey: uploaded.key,
      deliveryFileName: file.name,
      status: "REVIEW",
    },
  });

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath(`/dashboard/orders/${orderId}`);
  return ok({ fileName: file.name });
}

export async function startOrderStripePayment(orderId: string, locale = "en", clientOrigin?: string) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const paymentSettings = await getPaymentSettings();
  if (!paymentSettings.stripeEnabled) {
    return fail("Stripe payments are disabled");
  }

  const order = await prisma.customOrder.findUnique({ where: { id: orderId } });
  if (!order || order.clientId !== user.id) return fail("Not found");
  if (!order.finalAmountCents || order.paymentStatus === "PAID") return fail("Payment not available");

  try {
    assertStripeConfigured();
    const session = await createOrderPaymentCheckout(
      user.id,
      user.email,
      order.id,
      order.invoiceNumber ?? order.id,
      order.finalAmountCents,
      locale,
      { clientOrigin }
    );

    if (!session.url) return fail("Stripe did not return a checkout URL");
    return ok({ url: session.url, sessionId: session.id });
  } catch (err) {
    return fail(`Checkout failed: ${formatStripeError(err)}`);
  }
}

export async function markOrderPaidManual(
  orderId: string,
  method: OrderPaymentMethod,
  reference?: string
) {
  const { error } = await requireActionPermission("orders.write");
  if (error) return error;

  await prisma.customOrder.update({
    where: { id: orderId },
    data: {
      paymentStatus: "PAID",
      paymentMethod: method,
      paymentReference: reference,
      status: "IN_REVIEW",
    },
  });

  revalidatePath(`/admin/orders/${orderId}`);
  return ok(undefined);
}

export async function payOrderWithCredits(_orderId: string) {
  return fail("Credit payments removed. Pay with Stripe from your order page.");
}

export async function sendOrderMessage(orderId: string, content: string, isInternal = false) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const order = await prisma.customOrder.findUnique({ where: { id: orderId } });
  if (!order) return fail("Order not found");

  const isStaff = hasPermission(user.role, "orders.write");
  if (order.clientId !== user.id && !isStaff) return fail("Forbidden");

  await prisma.orderMessage.create({
    data: {
      orderId,
      senderId: user.id,
      content,
      isInternal: isStaff ? isInternal : false,
    },
  });

  void onOrderMessageSent({
    orderId,
    senderId: user.id,
    clientId: order.clientId,
    assigneeId: order.assigneeId,
    isInternal: isStaff ? isInternal : false,
    content,
  });

  revalidatePath(`/dashboard/orders/${orderId}`);
  revalidatePath(`/admin/orders/${orderId}`);
  return ok(undefined);
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  assigneeId?: string
) {
  const { user, error } = await requireAnyActionPermission("orders.write", "orders.manage", "custom_orders.manage");
  if (error) return error;

  await transitionOrderStatus({
    orderId,
    status,
    actorId: user.id,
    assigneeId,
  });

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath(`/dashboard/orders/${orderId}`);
  revalidatePath(`/designer/orders`);
  return ok(undefined);
}

export async function assignOrder(orderId: string, assigneeId: string | null, team?: string) {
  const { user, error } = await requireAnyActionPermission("orders.assign", "orders.write", "custom_orders.manage");
  if (error) return error;

  const order = await prisma.customOrder.update({
    where: { id: orderId },
    data: {
      assigneeId,
      assignedTeam: team ?? undefined,
      ...(assigneeId ? { status: "ASSIGNED" } : {}),
    },
    select: { id: true, title: true, clientId: true, assigneeId: true },
  });

  await logOrderActivity(orderId, "order.assigned", user.id, { assigneeId, team });

  if (assigneeId) {
    const { notifyOrderUpdate } = await import("@/lib/notifications-service");
    await notifyOrderUpdate({
      userId: assigneeId,
      title: "Order assigned to you",
      body: order.title,
      orderId: order.id,
    });
    await notifyOrderUpdate({
      userId: order.clientId,
      title: "Order assigned",
      body: `Your order "${order.title}" has been assigned to our team.`,
      orderId: order.id,
    });
  }

  revalidatePath(`/admin/orders/${orderId}`);
  return ok(undefined);
}

export async function updateOrderInternalNotes(orderId: string, notes: string) {
  const { user, error } = await requireAnyActionPermission("orders.write", "custom_orders.manage");
  if (error) return error;

  await prisma.customOrder.update({
    where: { id: orderId },
    data: { internalNotes: notes },
  });
  await logOrderActivity(orderId, "notes.updated", user.id);
  revalidatePath(`/admin/orders/${orderId}`);
  return ok(undefined);
}

export async function uploadOrderDeliveryVersion(orderId: string, formData: FormData) {
  const { user, error } = await requireAnyActionPermission("orders.write", "orders.complete", "custom_orders.manage");
  if (error) return error;

  const file = formData.get("file");
  const notes = String(formData.get("notes") ?? "").trim() || undefined;
  const isRevision = formData.get("isRevision") === "true";
  if (!(file instanceof File)) return fail("No file");

  const buffer = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^\w.-]/g, "_");
  const key = `orders/${orderId}/deliveries/${Date.now()}-${safeName}`;
  const uploaded = await uploadAsset({
    bucket: "tickets",
    relativePath: key,
    body: buffer,
    contentType: file.type || "application/octet-stream",
  });

  const last = await prisma.orderDelivery.findFirst({
    where: { orderId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const version = (last?.version ?? 0) + 1;

  await prisma.orderDelivery.create({
    data: {
      orderId,
      version,
      fileKey: uploaded.key,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      fileSize: file.size,
      notes,
      uploadedById: user.id,
      isRevision,
    },
  });

  await prisma.customOrder.update({
    where: { id: orderId },
    data: {
      deliveryFileKey: uploaded.key,
      deliveryFileName: file.name,
      status: "DELIVERED",
      deliveredAt: new Date(),
    },
  });

  await logOrderActivity(orderId, "delivery.uploaded", user.id, { version, fileName: file.name });

  const order = await prisma.customOrder.findUnique({
    where: { id: orderId },
    select: { clientId: true, title: true, assigneeId: true },
  });
  if (order) {
    const { notifyOrderStakeholders } = await import("@/lib/order-workflow");
    await notifyOrderStakeholders({
      orderId,
      title: "Delivery ready",
      body: `Your order "${order.title}" has a new delivery ready for review.`,
      clientId: order.clientId,
      assigneeId: order.assigneeId,
      emailTemplate: "completed",
    });
  }

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath(`/dashboard/orders/${orderId}`);
  return ok({ fileName: file.name, version });
}

export async function getAssignableStaff() {
  const { error } = await requireAnyActionPermission("orders.assign", "orders.write");
  if (error) return error;

  const staff = await prisma.user.findMany({
    where: {
      deletedAt: null,
      isBanned: false,
      role: { in: ["OWNER", "ADMIN", "DESIGNER", "SUPPORT"] },
    },
    select: { id: true, username: true, displayName: true, role: true },
    orderBy: { username: "asc" },
  });
  return ok(staff);
}

export async function getAdminOrders(status?: string) {
  const { error } = await requireActionPermission("orders.read");
  if (error) return error;

  const orders = await prisma.customOrder.findMany({
    where: status ? { status: status as never } : undefined,
    orderBy: { updatedAt: "desc" },
    include: {
      client: { select: { username: true } },
      assignee: { select: { username: true } },
      _count: { select: { messages: true } },
    },
    take: 100,
  });
  return ok(orders);
}

export async function getUserOrders() {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const orders = await prisma.customOrder.findMany({
    where: { clientId: user.id },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { messages: true } } },
  });
  return ok(orders);
}

export async function getOrderDetail(orderId: string) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const order = await prisma.customOrder.findUnique({
    where: { id: orderId },
    include: {
      client: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      assignee: { select: { id: true, username: true, displayName: true } },
      shopProduct: { select: { id: true, name: true, slug: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          sender: { select: { username: true, displayName: true, avatarUrl: true, role: true } },
          attachments: true,
        },
      },
      attachments: true,
      deliveries: { orderBy: { version: "desc" }, include: { uploadedBy: { select: { username: true } } } },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { actor: { select: { username: true } } },
      },
    },
  });

  if (!order) return fail("Not found");

  const canManage = await userHasPermission(
    { id: user.id, role: user.role, permissionGroupId: user.permissionGroupId },
    "orders.write"
  ) || await userHasPermission(
    { id: user.id, role: user.role, permissionGroupId: user.permissionGroupId },
    "custom_orders.manage"
  );

  const canView =
    order.clientId === user.id ||
    order.assigneeId === user.id ||
    hasPermission(user.role, "orders.read") ||
    canManage;

  if (!canView) return fail("Forbidden");

  const messages =
    canManage || hasPermission(user.role, "orders.read")
      ? order.messages
      : order.messages.filter((m) => !m.isInternal);

  return ok({ ...order, messages });
}

const ORDER_REQUIREMENT_FIELDS = [
  "projectDescription",
  "requirements",
  "notes",
  "preferredStyle",
  "budgetNotes",
  "deadline",
] as const;

export async function submitOrderRequirements(orderId: string, formData: FormData, locale = "en") {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const order = await prisma.customOrder.findUnique({ where: { id: orderId } });
  if (!order || order.clientId !== user.id) return fail("Not found");
  if (order.requirementsSubmittedAt) return fail("Requirements already submitted");
  if (order.paymentStatus !== "PAID" && order.shopProductId) {
    return fail("Complete payment before submitting project details");
  }

  const responses: Record<string, string> = {};
  for (const key of ORDER_REQUIREMENT_FIELDS) {
    const value = String(formData.get(key) ?? "").trim();
    if (value) responses[key] = value;
  }

  const projectDescription = responses.projectDescription ?? "";
  const requirements = responses.requirements ?? "";
  if (!projectDescription && !requirements) {
    return fail("Provide a project description or requirements");
  }

  const description = [
    projectDescription && `Project: ${projectDescription}`,
    requirements && `Requirements:\n${requirements}`,
    responses.notes && `Notes: ${responses.notes}`,
    responses.preferredStyle && `Style: ${responses.preferredStyle}`,
    responses.budgetNotes && `Budget notes: ${responses.budgetNotes}`,
    responses.deadline && `Deadline: ${responses.deadline}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  await prisma.customOrder.update({
    where: { id: orderId },
    data: {
      description,
      formResponses: {
        ...(typeof order.formResponses === "object" && order.formResponses !== null
          ? (order.formResponses as Record<string, unknown>)
          : {}),
        ...responses,
      } as object,
    },
  });

  await prisma.orderMessage.create({
    data: { orderId, senderId: user.id, content: description },
  });

  const files = formData
    .getAll("order_files")
    .filter((f): f is File => f instanceof File && f.size > 0);

  const { ALLOWED_ORDER_UPLOAD_MIMES, MAX_ORDER_UPLOAD_BYTES, MAX_ORDER_UPLOAD_FILES } = await import("@/lib/shop-enterprise");
  if (files.length > MAX_ORDER_UPLOAD_FILES) return fail(`Maximum ${MAX_ORDER_UPLOAD_FILES} files`);

  for (const file of files) {
    if (file.size > MAX_ORDER_UPLOAD_BYTES) return fail(`${file.name} exceeds upload limit`);
    const allowed =
      ALLOWED_ORDER_UPLOAD_MIMES.includes(file.type) ||
      file.name.match(/\.(zip|rar|7z|psd|png|jpe?g|webp|pdf)$/i);
    if (!allowed) return fail(`File type not allowed: ${file.name}`);

    const buffer = Buffer.from(await file.arrayBuffer());
    const safeName = file.name.replace(/[^\w.-]/g, "_");
    const uploaded = await uploadAsset({
      bucket: "tickets",
      relativePath: `orders/${orderId}/refs/${Date.now()}-${safeName}`,
      body: buffer,
      contentType: file.type || "application/octet-stream",
    });
    await prisma.orderAttachment.create({
      data: {
        orderId,
        fileKey: uploaded.key,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
      },
    });
  }

  await onOrderRequirementsSubmitted(orderId, locale);

  revalidatePath(`/dashboard/orders/${orderId}`);
  revalidatePath(`/admin/orders/${orderId}`);
  return ok(undefined);
}

export async function acceptOrderAssignment(orderId: string, locale = "en") {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const order = await prisma.customOrder.findUnique({ where: { id: orderId } });
  if (!order || order.assigneeId !== user.id) return fail("Not assigned to you");
  if (order.status !== "ASSIGNED") return fail("Order is not awaiting acceptance");

  await transitionOrderStatus({
    orderId,
    status: "IN_PROGRESS",
    actorId: user.id,
    locale,
  });

  revalidatePath(`/designer/orders`);
  revalidatePath(`/dashboard/orders/${orderId}`);
  return ok(undefined);
}

export async function rejectOrderAssignment(orderId: string, reason: string, locale = "en") {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const order = await prisma.customOrder.findUnique({ where: { id: orderId } });
  if (!order || order.assigneeId !== user.id) return fail("Not assigned to you");
  if (order.status !== "ASSIGNED") return fail("Order is not awaiting acceptance");

  await prisma.customOrder.update({
    where: { id: orderId },
    data: { assigneeId: null, status: "IN_REVIEW" },
  });

  await logOrderActivity(orderId, "assignment.rejected", user.id, { reason });
  await onOrderMessageSent({
    orderId,
    senderId: user.id,
    clientId: order.clientId,
    assigneeId: null,
    isInternal: true,
    content: `Designer rejected assignment: ${reason}`,
    locale,
  });

  revalidatePath(`/designer/orders`);
  revalidatePath(`/admin/orders/${orderId}`);
  return ok(undefined);
}