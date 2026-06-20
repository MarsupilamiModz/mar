import { NextResponse } from "next/server";
import { requireAuthApi } from "@/lib/auth";
import { apiUserHasPermission } from "@/lib/api-auth";
import { bulkGenerateLicenses } from "@/actions/admin/licenses";

export async function POST(req: Request) {
  const user = await requireAuthApi();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await apiUserHasPermission(user, "licenses.write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data = body as Record<string, unknown>;
  const result = await bulkGenerateLicenses({
    count: Number(data.count) || 10,
    productType: (data.productType as string) ?? "premium",
    modId: data.modId as string | undefined,
    label: data.label as string | undefined,
    maxActivations: data.maxActivations as number | undefined,
    expiresAt: data.expiresAt as string | undefined,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true, data: result.data });
}
