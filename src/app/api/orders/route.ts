import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuthApi } from "@/lib/auth";
import { customOrderSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";
import { logToDiscordWebhook } from "@/lib/discord";
import { formatZodError } from "@/lib/action-utils";

export async function POST(req: Request) {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limit = rateLimit(`order:${user.id}`, 3, 3600_000);
  if (!limit.success) return NextResponse.json({ error: "Rate limited" }, { status: 429 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = customOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  }

  try {
    const order = await prisma.customOrder.create({
      data: {
        clientId: user.id,
        title: parsed.data.title,
        description: parsed.data.description,
        orderType: parsed.data.orderType,
        budgetCents: parsed.data.budgetCents,
      },
    });

    await logToDiscordWebhook({
      title: "New Custom Order",
      description: `**${parsed.data.title}** by @${user.username}`,
    });

    return NextResponse.json({ id: order.id });
  } catch (err) {
    console.error("[api/orders]", err);
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }
}
