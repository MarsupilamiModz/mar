import { NextResponse } from "next/server";
import { requireAuthApi } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { bulkGenerateLicenses } from "@/actions/admin/licenses";

export async function POST(req: Request) {
  const user = await requireAuthApi();
  if (!user || !hasPermission(user.role, "licenses.write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const result = await bulkGenerateLicenses({
    count: Number(body.count) || 10,
    productType: body.productType ?? "premium",
    modId: body.modId,
    label: body.label,
    maxActivations: body.maxActivations,
    expiresAt: body.expiresAt,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true, data: result.data });
}
