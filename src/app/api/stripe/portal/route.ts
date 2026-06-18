import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createBillingPortalSession } from "@/lib/stripe";
import { createAuditLog } from "@/lib/audit";
import type { Locale } from "@/i18n/config";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let locale: Locale = "en";
  try {
    const body = await req.json();
    if (body?.locale) locale = body.locale;
  } catch {
    /* optional body */
  }

  try {
    const url = await createBillingPortalSession(user.id, user.email, locale);
    await createAuditLog({
      actorId: user.id,
      action: "billing.portal_opened",
      entityType: "User",
      entityId: user.id,
    });
    return NextResponse.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Billing portal unavailable";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
