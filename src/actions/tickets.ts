"use server";

import { revalidatePath } from "next/cache";
import { TicketCategory, TicketPriority, TicketStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { fail, ok, requireActionPermission, requireActionUser, type ActionResult } from "@/lib/action-utils";
import { hasPermission } from "@/lib/permissions";
import { ALLOWED_UPLOAD_TYPES, uploadToR2 } from "@/lib/r2";
import { sendTicketNotification } from "@/lib/email";
import {
  notifyStaffNewTicket,
  notifyTicketAssigned,
  notifyTicketReply,
} from "@/lib/notifications-service";
import { computeSlaDueDates, isSlaOverdue } from "@/lib/sla";
import { categoryToDepartment } from "@/lib/ticket-labels";
import { randomBytes } from "crypto";

const createTicketSchema = z.object({
  subject: z.string().min(5).max(200),
  category: z.nativeEnum(TicketCategory),
  message: z.string().min(10).max(10000),
  priority: z.nativeEnum(TicketPriority).optional(),
});

const replySchema = z.object({
  ticketId: z.string().cuid(),
  content: z.string().min(1).max(10000),
  isInternal: z.boolean().optional(),
});

async function generateTicketNumber() {
  const num = `XM-${Date.now().toString(36).toUpperCase()}-${randomBytes(2).toString("hex").toUpperCase()}`;
  const exists = await prisma.supportTicket.findUnique({ where: { ticketNumber: num } });
  if (exists) return generateTicketNumber();
  return num;
}

export async function createTicket(input: {
  subject: string;
  category: TicketCategory;
  message: string;
  priority?: TicketPriority;
}) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const parsed = createTicketSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.message);

  const ticketNumber = await generateTicketNumber();
  const priority = parsed.data.priority ?? "NORMAL";
  const sla = computeSlaDueDates(priority);

  const ticket = await prisma.supportTicket.create({
    data: {
      ticketNumber,
      userId: user.id,
      subject: parsed.data.subject,
      category: parsed.data.category,
      department: categoryToDepartment(parsed.data.category),
      priority,
      status: "NEW",
      slaResponseDueAt: sla.slaResponseDueAt,
      slaResolveDueAt: sla.slaResolveDueAt,
      messages: {
        create: {
          senderId: user.id,
          content: parsed.data.message,
          isStaff: false,
        },
      },
    },
    include: {
      messages: true,
      user: { select: { username: true, email: true, displayName: true } },
    },
  });

  void sendTicketNotification({
    type: "created",
    ticketNumber: ticket.ticketNumber,
    subject: ticket.subject,
    message: parsed.data.message,
    username: ticket.user.displayName ?? ticket.user.username,
    userEmail: ticket.user.email,
  });

  void notifyStaffNewTicket({
    ticketId: ticket.id,
    ticketNumber: ticket.ticketNumber,
    subject: ticket.subject,
    department: categoryToDepartment(parsed.data.category),
  });

  revalidatePath("/dashboard/support");
  return ok({ ticketId: ticket.id, ticketNumber: ticket.ticketNumber });
}

export async function replyToTicket(
  ticketId: string,
  content: string,
  isStaffOverride?: boolean,
  isInternal = false
) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const parsed = replySchema.safeParse({ ticketId, content, isInternal });
  if (!parsed.success) return fail("Invalid message");

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: { user: { select: { id: true, username: true, email: true, displayName: true } } },
  });
  if (!ticket) return fail("Ticket not found");

  const isStaff = isStaffOverride ?? hasPermission(user.role, "tickets.write");

  if (!isStaff && ticket.userId !== user.id) return fail("Forbidden");
  if (ticket.status === "CLOSED" && !isStaff) return fail("Ticket is closed");
  if (isInternal && !isStaff) return fail("Forbidden");

  await prisma.ticketMessage.create({
    data: {
      ticketId,
      senderId: user.id,
      content: parsed.data.content,
      isStaff,
      isInternal: isInternal && isStaff,
    },
  });

  const newStatus: TicketStatus = isInternal
    ? ticket.status
    : isStaff
      ? "WAITING_FOR_USER"
      : "WAITING_FOR_STAFF";

  const updateData: {
    status: TicketStatus;
    updatedAt: Date;
    firstResponseAt?: Date;
  } = {
    status: newStatus,
    updatedAt: new Date(),
  };

  if (isStaff && !ticket.firstResponseAt && !isInternal) {
    updateData.firstResponseAt = new Date();
  }

  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: updateData,
  });

  if (!isInternal) {
    void sendTicketNotification({
      type: "reply",
      ticketNumber: ticket.ticketNumber,
      subject: ticket.subject,
      message: parsed.data.content,
      username: isStaff
        ? user.displayName ?? user.username
        : ticket.user.displayName ?? ticket.user.username,
      userEmail: isStaff ? ticket.user.email : undefined,
    });

    if (isStaff) {
      void notifyTicketReply({
        userId: ticket.user.id,
        ticketNumber: ticket.ticketNumber,
        subject: ticket.subject,
        ticketId,
      });
    }
  }

  revalidatePath(`/dashboard/support/${ticketId}`);
  revalidatePath(`/admin/tickets/${ticketId}`);
  return ok(undefined);
}

export async function updateTicketStatus(
  ticketId: string,
  status: TicketStatus
): Promise<ActionResult> {
  const { user, error } = await requireActionPermission("tickets.write");
  if (error) return error;

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: { user: { select: { username: true, email: true, displayName: true } } },
  });
  if (!ticket) return fail("Ticket not found");

  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: {
      status,
      closedAt: status === "CLOSED" ? new Date() : null,
    },
  });

  void sendTicketNotification({
    type: "updated",
    ticketNumber: ticket.ticketNumber,
    subject: ticket.subject,
    message: `Ticket status changed to ${status.replace(/_/g, " ")}`,
    username: ticket.user.displayName ?? ticket.user.username,
    userEmail: ticket.user.email,
  });

  await createAuditLog({
    actorId: user.id,
    action: "ticket.status_change",
    entityType: "SupportTicket",
    entityId: ticketId,
    metadata: { from: ticket.status, to: status },
  });

  revalidatePath(`/admin/tickets/${ticketId}`);
  revalidatePath("/admin/tickets");
  return ok(undefined);
}

export async function assignTicket(
  ticketId: string,
  assigneeId: string | null
): Promise<ActionResult> {
  const { user, error } = await requireActionPermission("tickets.write");
  if (error) return error;

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: { ticketNumber: true, subject: true },
  });
  if (!ticket) return fail("Ticket not found");

  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { assigneeId, status: assigneeId ? "IN_PROGRESS" : "OPEN" },
  });

  if (assigneeId) {
    void notifyTicketAssigned({
      assigneeId,
      ticketId,
      ticketNumber: ticket.ticketNumber,
      subject: ticket.subject,
      assignedBy: user.username,
    });
  }

  await createAuditLog({
    actorId: user.id,
    action: "ticket.assign",
    entityType: "SupportTicket",
    entityId: ticketId,
    metadata: { assigneeId },
  });

  revalidatePath(`/admin/tickets/${ticketId}`);
  return ok(undefined);
}

export async function updateTicketPriority(
  ticketId: string,
  priority: TicketPriority
): Promise<ActionResult> {
  const { error } = await requireActionPermission("tickets.write");
  if (error) return error;

  const sla = computeSlaDueDates(priority);
  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: {
      priority,
      slaResponseDueAt: sla.slaResponseDueAt,
      slaResolveDueAt: sla.slaResolveDueAt,
    },
  });

  revalidatePath(`/admin/tickets/${ticketId}`);
  return ok(undefined);
}

export async function closeTicket(ticketId: string, asUser = false): Promise<ActionResult> {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) return fail("Ticket not found");

  if (asUser && ticket.userId !== user.id) return fail("Forbidden");
  if (!asUser && !hasPermission(user.role, "tickets.write")) return fail("Forbidden");

  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { status: "CLOSED", closedAt: new Date() },
  });

  revalidatePath(`/dashboard/support/${ticketId}`);
  revalidatePath(`/admin/tickets/${ticketId}`);
  return ok(undefined);
}

export async function reopenTicket(ticketId: string): Promise<ActionResult> {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) return fail("Ticket not found");

  const isOwner = ticket.userId === user.id;
  const isStaff = hasPermission(user.role, "tickets.write");
  if (!isOwner && !isStaff) return fail("Forbidden");

  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { status: "OPEN", closedAt: null },
  });

  revalidatePath(`/dashboard/support/${ticketId}`);
  revalidatePath(`/admin/tickets/${ticketId}`);
  return ok(undefined);
}

export async function uploadTicketAttachment(formData: FormData) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const ticketId = formData.get("ticketId") as string;
  const messageId = (formData.get("messageId") as string) || undefined;
  const file = formData.get("file") as File;

  if (!ticketId || !file) return fail("Missing file or ticket");

  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) return fail("Ticket not found");
  if (ticket.userId !== user.id && !hasPermission(user.role, "tickets.write")) {
    return fail("Forbidden");
  }

  if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) return fail("File type not allowed");
  if (file.size > 25 * 1024 * 1024) return fail("File too large (max 25MB)");

  const buffer = Buffer.from(await file.arrayBuffer());
  const key = `tickets/${ticketId}/${randomBytes(8).toString("hex")}-${file.name}`;
  await uploadToR2(key, buffer, file.type);

  const attachment = await prisma.ticketAttachment.create({
    data: {
      ticketId,
      messageId,
      fileKey: key,
      fileName: file.name,
      mimeType: file.type,
      fileSize: file.size,
      uploadedById: user.id,
    },
  });

  return ok({ attachmentId: attachment.id, fileKey: key });
}

export async function getTicketsForUser(params?: { page?: number }) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const page = params?.page ?? 1;
  const limit = 20;
  const skip = (page - 1) * limit;

  const [tickets, total] = await Promise.all([
    prisma.supportTicket.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      skip,
      take: limit,
      include: {
        assignee: { select: { username: true } },
        _count: { select: { messages: true } },
      },
    }),
    prisma.supportTicket.count({ where: { userId: user.id } }),
  ]);

  return ok({ tickets, total, pages: Math.ceil(total / limit), page });
}

export async function getTicketsAdmin(params: {
  page?: number;
  status?: TicketStatus;
  category?: TicketCategory;
  priority?: TicketPriority;
  search?: string;
  assigneeId?: string;
}) {
  const { error } = await requireActionPermission("tickets.read");
  if (error) return error;

  const page = params.page ?? 1;
  const limit = 20;
  const skip = (page - 1) * limit;

  const where = {
    ...(params.status && { status: params.status }),
    ...(params.category && { category: params.category }),
    ...(params.priority && { priority: params.priority }),
    ...(params.assigneeId && { assigneeId: params.assigneeId }),
    ...(params.search && {
      OR: [
        { subject: { contains: params.search, mode: "insensitive" as const } },
        { ticketNumber: { contains: params.search, mode: "insensitive" as const } },
        { user: { username: { contains: params.search, mode: "insensitive" as const } } },
      ],
    }),
  };

  const [tickets, total] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
      skip,
      take: limit,
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } },
        assignee: { select: { id: true, username: true } },
        _count: { select: { messages: true } },
      },
    }),
    prisma.supportTicket.count({ where }),
  ]);

  return ok({ tickets, total, pages: Math.ceil(total / limit), page });
}

export async function getTicketDetail(ticketId: string) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: {
      user: { select: { id: true, username: true, email: true, avatarUrl: true } },
      assignee: { select: { id: true, username: true, avatarUrl: true } },
      watchers: { select: { userId: true, user: { select: { username: true } } } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          sender: { select: { id: true, username: true, displayName: true, avatarUrl: true, role: true } },
          attachments: true,
        },
      },
      attachments: true,
    },
  });

  if (!ticket) return fail("Ticket not found");

  const canView =
    ticket.userId === user.id || hasPermission(user.role, "tickets.read");
  if (!canView) return fail("Forbidden");

  const isStaff = hasPermission(user.role, "tickets.read");
  const filteredMessages = isStaff
    ? ticket.messages
    : ticket.messages.filter((m) => !m.isInternal);

  return ok({ ticket: { ...ticket, messages: filteredMessages } });
}

export async function claimTicket(ticketId: string) {
  const { user, error } = await requireActionPermission("tickets.write");
  if (error) return error;

  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { assigneeId: user.id, status: "IN_PROGRESS" },
  });

  await createAuditLog({
    actorId: user.id,
    action: "ticket.claim",
    entityType: "SupportTicket",
    entityId: ticketId,
  });

  revalidatePath(`/admin/tickets/${ticketId}`);
  return ok(undefined);
}

export async function escalateTicket(ticketId: string) {
  const { user, error } = await requireActionPermission("tickets.write");
  if (error) return error;

  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: {
      status: "ESCALATED",
      priority: "URGENT",
      escalatedAt: new Date(),
    },
  });

  await createAuditLog({
    actorId: user.id,
    action: "ticket.escalate",
    entityType: "SupportTicket",
    entityId: ticketId,
  });

  revalidatePath(`/admin/tickets/${ticketId}`);
  return ok(undefined);
}

export async function addTicketTags(ticketId: string, tags: string[]) {
  const { error } = await requireActionPermission("tickets.write");
  if (error) return error;

  const cleaned = Array.from(new Set(tags.map((t) => t.trim()).filter(Boolean))).slice(0, 20);
  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { tags: cleaned },
  });

  revalidatePath(`/admin/tickets/${ticketId}`);
  return ok(undefined);
}

export async function addInternalNote(ticketId: string, content: string) {
  return replyToTicket(ticketId, content, true, true);
}

export async function getTicketSlaStatus(ticketId: string) {
  const { error } = await requireActionPermission("tickets.read");
  if (error) return error;

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: {
      slaResponseDueAt: true,
      slaResolveDueAt: true,
      firstResponseAt: true,
      status: true,
    },
  });
  if (!ticket) return fail("Ticket not found");

  const resolved = ticket.status === "RESOLVED" || ticket.status === "CLOSED";
  return ok({
    responseOverdue: isSlaOverdue(ticket.slaResponseDueAt, !!ticket.firstResponseAt || resolved),
    resolveOverdue: isSlaOverdue(ticket.slaResolveDueAt, resolved),
    slaResponseDueAt: ticket.slaResponseDueAt,
    slaResolveDueAt: ticket.slaResolveDueAt,
    firstResponseAt: ticket.firstResponseAt,
  });
}

export async function transferTicketDepartment(
  ticketId: string,
  department: import("@prisma/client").TicketDepartment
): Promise<ActionResult> {
  const { user, error } = await requireActionPermission("tickets.write");
  if (error) return error;

  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { department, status: "PENDING" },
  });

  await createAuditLog({
    actorId: user.id,
    action: "ticket.transfer",
    entityType: "SupportTicket",
    entityId: ticketId,
    metadata: { department },
  });

  revalidatePath(`/admin/tickets/${ticketId}`);
  return ok(undefined);
}

export async function addTicketWatcher(ticketId: string, userId: string): Promise<ActionResult> {
  const { error } = await requireActionPermission("tickets.write");
  if (error) return error;

  await prisma.ticketWatcher.upsert({
    where: { ticketId_userId: { ticketId, userId } },
    create: { ticketId, userId },
    update: {},
  });

  revalidatePath(`/admin/tickets/${ticketId}`);
  return ok(undefined);
}

export async function removeTicketWatcher(ticketId: string, userId: string): Promise<ActionResult> {
  const { error } = await requireActionPermission("tickets.write");
  if (error) return error;

  await prisma.ticketWatcher.deleteMany({ where: { ticketId, userId } });
  revalidatePath(`/admin/tickets/${ticketId}`);
  return ok(undefined);
}

export async function getTicketDashboardStats() {
  const { error } = await requireActionPermission("tickets.read");
  if (error) return error;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const openStatuses: TicketStatus[] = [
    "NEW",
    "OPEN",
    "PENDING",
    "IN_PROGRESS",
    "WAITING_FOR_USER",
    "WAITING_FOR_STAFF",
    "ESCALATED",
  ];

  const [
    openTickets,
    unassigned,
    assigned,
    slaViolations,
    pendingResponses,
    resolvedToday,
    avgResponseAgg,
  ] = await Promise.all([
    prisma.supportTicket.count({ where: { status: { in: openStatuses } } }),
    prisma.supportTicket.count({ where: { assigneeId: null, status: { in: openStatuses } } }),
    prisma.supportTicket.count({ where: { assigneeId: { not: null }, status: { in: openStatuses } } }),
    prisma.supportTicket.count({
      where: {
        status: { in: openStatuses },
        OR: [
          { slaResponseDueAt: { lt: new Date() }, firstResponseAt: null },
          { slaResolveDueAt: { lt: new Date() } },
        ],
      },
    }),
    prisma.supportTicket.count({ where: { status: "WAITING_FOR_STAFF" } }),
    prisma.supportTicket.count({
      where: { status: { in: ["RESOLVED", "CLOSED"] }, updatedAt: { gte: todayStart } },
    }),
    prisma.supportTicket.findMany({
      where: { firstResponseAt: { not: null } },
      select: { createdAt: true, firstResponseAt: true },
      take: 200,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  let avgResponseMinutes = 0;
  if (avgResponseAgg.length > 0) {
    const totalMs = avgResponseAgg.reduce((sum, t) => {
      if (!t.firstResponseAt) return sum;
      return sum + (t.firstResponseAt.getTime() - t.createdAt.getTime());
    }, 0);
    avgResponseMinutes = Math.round(totalMs / avgResponseAgg.length / 60000);
  }

  return ok({
    openTickets,
    unassigned,
    assigned,
    slaViolations,
    pendingResponses,
    resolvedToday,
    avgResponseMinutes,
  });
}
