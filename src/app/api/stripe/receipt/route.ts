import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { userOwnsStripePayment } from "@/lib/api-auth";
import { getStripeReceiptUrl } from "@/lib/stripe";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const paymentIntent = new URL(req.url).searchParams.get("paymentIntent");
  if (!paymentIntent) return NextResponse.json({ error: "paymentIntent required" }, { status: 400 });

  const allowed = await userOwnsStripePayment(user.id, user.role, paymentIntent);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = await getStripeReceiptUrl(paymentIntent);
  if (!url) return NextResponse.json({ error: "Receipt not available" }, { status: 404 });

  return NextResponse.json({ url });
}
