import { getAppUrl } from "@/lib/app-url";
import { formatCreditsFromCents } from "@/lib/credits";

type SendEmailParams = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
};

export async function sendEmail(params: SendEmailParams): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "MarsupilamiModz <orders@marsupilami-modz.com>";

  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not set — logging email instead");
    console.info("[email]", params.subject, "→", params.to);
    return false;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: Array.isArray(params.to) ? params.to : [params.to],
      subject: params.subject,
      html: params.html,
      text: params.text,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("[email] Resend error:", res.status, body);
    return false;
  }

  return true;
}

export async function sendCustomOrderNotification(order: {
  id: string;
  title: string;
  description: string;
  orderType: string;
  budgetCents?: number | null;
  invoiceNumber?: string | null;
  client: {
    username: string;
    email: string;
    displayName?: string | null;
    discordUsername?: string | null;
  };
  attachments?: { fileName: string }[];
}) {
  const adminEmail = process.env.ADMIN_ORDER_EMAIL ?? process.env.EMAIL_FROM?.match(/<(.+)>/)?.[1];
  if (!adminEmail) {
    console.warn("[email] No ADMIN_ORDER_EMAIL configured");
    return false;
  }

  const name = order.client.displayName ?? order.client.username;
  const budget = order.budgetCents ? formatCreditsFromCents(order.budgetCents) : "Not specified";
  const attachmentList = order.attachments?.length
    ? `<ul>${order.attachments.map((a) => `<li>${a.fileName}</li>`).join("")}</ul>`
    : "<p>None</p>";

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#0a0a0f;color:#f4f4f5;border-radius:12px;border:1px solid #a855f740">
      <h1 style="color:#a855f7;margin:0 0 16px">New Custom Order</h1>
      <p><strong>Title:</strong> ${order.title}</p>
      <p><strong>Type:</strong> ${order.orderType}</p>
      <p><strong>Budget:</strong> ${budget}</p>
      <p><strong>Customer:</strong> ${name} (${order.client.email})</p>
      <p><strong>Discord:</strong> ${order.client.discordUsername ?? "—"}</p>
      <p><strong>Invoice:</strong> ${order.invoiceNumber ?? "Pending"}</p>
      <p><strong>Description:</strong></p>
      <pre style="white-space:pre-wrap;background:#18181b;padding:12px;border-radius:8px">${order.description}</pre>
      <p><strong>References:</strong></p>
      ${attachmentList}
      <p style="margin-top:24px"><a href="${getAppUrl()}/en/admin/orders/${order.id}" style="color:#60a5fa">View in admin →</a></p>
    </div>
  `;

  return sendEmail({
    to: adminEmail,
    subject: `[Custom Order] ${order.title} — ${name}`,
    html,
    text: `New custom order: ${order.title}\nCustomer: ${name} <${order.client.email}>\nType: ${order.orderType}\nBudget: ${budget}`,
  });
}
