import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

/** Billing portal removed — memberships are one-time lifetime purchases. Use receipt links instead. */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json(
    { error: "Recurring billing is disabled. View receipts on your Membership page." },
    { status: 400 }
  );
}
