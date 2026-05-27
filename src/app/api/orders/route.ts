import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuthApi } from "@/lib/auth";
import { customOrderSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";
import { logToDiscordWebhook } from "@/lib/discord";

export async function POST(req: Request) {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limit = rateLimit(`order:${user.id}`, 3, 3600_000);
  if (!limit.success) return NextResponse.json({ error: "Rate limited" }, { status: 429 });

  const data = customOrderSchema.parse(await req.json());
  const order = await prisma.customOrder.create({
    data: {
      clientId: user.id,
      title: data.title,
      description: data.description,
      orderType: data.orderType,
      budgetCents: data.budgetCents,
    },
  });

  await logToDiscordWebhook({
    title: "New Custom Order",
    description: `**${data.title}** by @${user.username}`,
  });

  return NextResponse.json({ id: order.id });
}
