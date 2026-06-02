"use server";

import { z } from "zod";
import { fail, ok } from "@/lib/action-utils";
import { sendEmail } from "@/lib/email/send";
import { getEmailSettings, resolveTargetEmail } from "@/lib/email/settings";
import { getEmailTemplates, renderTemplate } from "@/lib/email/templates";
import { SITE } from "@/lib/site";
import { rateLimit } from "@/lib/rate-limit";

const contactSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  message: z.string().min(10).max(5000),
});

export async function sendContactMessage(input: z.infer<typeof contactSchema>) {
  const limit = rateLimit(`contact:${input.email}`, 3, 3600_000);
  if (!limit.success) return fail("Too many messages. Try again later.");

  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.message);

  const settings = await getEmailSettings();
  const to = resolveTargetEmail(settings, "contact");
  if (!to) return fail("Contact email is not configured");

  const templates = await getEmailTemplates();
  const tpl = templates.find((t) => t.key === "support");
  const rendered = tpl
    ? renderTemplate(tpl, {
        username: parsed.data.name,
        ticket_id: "CONTACT",
        subject: `Contact form — ${parsed.data.name}`,
        message: `${parsed.data.message}\n\nReply to: ${parsed.data.email}`,
        website_name: SITE.name,
      })
    : null;

  const sent = await sendEmail({
    to,
    subject: rendered?.subject ?? `[Contact] ${parsed.data.name}`,
    html:
      rendered?.html ??
      `<p><strong>Contact form</strong></p><p>From: ${parsed.data.name} (${parsed.data.email})</p><p>${parsed.data.message}</p>`,
    templateKey: "support",
  });

  if (!sent) return fail("Failed to send message. Please try again later.");
  return ok(undefined);
}
