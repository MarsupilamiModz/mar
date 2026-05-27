"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { fail, ok, requireActionUser, requireActionStaff } from "@/lib/action-utils";
import { customOrderSchema } from "@/lib/validations";
import { hasPermission } from "@/lib/permissions";
import { logToDiscordWebhook } from "@/lib/discord";
import { rateLimit } from "@/lib/rate-limit";
import { generateInvoiceNumber, formatPaymentReference } from "@/lib/invoices";
import { sendCustomOrderNotification } from "@/lib/email";
import { createOrderPaymentCheckout } from "@/lib/stripe";
import { uploadAsset } from "@/lib/asset-storage";
import { formatDisplayName } from "@/lib/display-name";
import { centsToCredits, creditWallet } from "@/lib/credits";
import type { OrderPaymentMethod } from "@prisma/client";

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
  const { error } = await requireActionStaff();
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
  });

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath(`/dashboard/orders/${orderId}`);
  return ok(order);
}

export async function uploadOrderDelivery(orderId: string, formData: FormData) {
  const { error } = await requireActionStaff();
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

export async function startOrderStripePayment(orderId: string, locale = "en") {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const order = await prisma.customOrder.findUnique({ where: { id: orderId } });
  if (!order || order.clientId !== user.id) return fail("Not found");
  if (!order.finalAmountCents || order.paymentStatus === "PAID") return fail("Payment not available");

  const session = await createOrderPaymentCheckout(
    user.id,
    user.email,
    order.id,
    order.invoiceNumber ?? order.id,
    order.finalAmountCents,
    locale
  );

  return ok({ url: session.url });
}

export async function markOrderPaidManual(
  orderId: string,
  method: OrderPaymentMethod,
  reference?: string
) {
  const { error } = await requireActionStaff();
  if (error) return error;

  await prisma.customOrder.update({
    where: { id: orderId },
    data: {
      paymentStatus: "PAID",
      paymentMethod: method,
      paymentReference: reference,
      status: "COMPLETED",
    },
  });

  revalidatePath(`/admin/orders/${orderId}`);
  return ok(undefined);
}

export async function payOrderWithCredits(orderId: string) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const order = await prisma.customOrder.findUnique({ where: { id: orderId } });
  if (!order || order.clientId !== user.id) return fail("Not found");
  if (!order.finalAmountCents) return fail("No amount quoted");
  if (order.paymentStatus === "PAID") return fail("Already paid");

  const creditsNeeded = centsToCredits(order.finalAmountCents);
  await creditWallet({
    userId: user.id,
    amount: -creditsNeeded,
    type: "ORDER_PAYMENT",
    description: `Custom order ${order.invoiceNumber}`,
    referenceId: order.id,
  });

  await prisma.customOrder.update({
    where: { id: orderId },
    data: {
      paymentStatus: "PAID",
      paymentMethod: "CREDITS",
      status: "COMPLETED",
    },
  });

  revalidatePath(`/dashboard/orders/${orderId}`);
  return ok(undefined);
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

  revalidatePath(`/dashboard/orders/${orderId}`);
  revalidatePath(`/admin/orders/${orderId}`);
  return ok(undefined);
}

export async function updateOrderStatus(
  orderId: string,
  status: "PENDING" | "QUOTED" | "IN_PROGRESS" | "REVIEW" | "COMPLETED" | "CANCELED",
  assigneeId?: string
) {
  const { error } = await requireActionStaff();
  if (error) return error;

  await prisma.customOrder.update({
    where: { id: orderId },
    data: { status, ...(assigneeId !== undefined && { assigneeId }) },
  });

  revalidatePath(`/admin/orders/${orderId}`);
  return ok(undefined);
}

export async function getAdminOrders(status?: string) {
  const { error } = await requireActionStaff();
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
      messages: {
        orderBy: { createdAt: "asc" },
        include: { sender: { select: { username: true, displayName: true, avatarUrl: true, role: true } } },
      },
      attachments: true,
    },
  });

  if (!order) return fail("Not found");
  const canView =
    order.clientId === user.id || hasPermission(user.role, "orders.read");
  if (!canView) return fail("Forbidden");

  const messages =
    hasPermission(user.role, "orders.read")
      ? order.messages
      : order.messages.filter((m) => !m.isInternal);

  return ok({ ...order, messages });
}