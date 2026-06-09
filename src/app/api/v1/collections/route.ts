import { NextResponse } from "next/server";
import { validateApiKey, hasScope } from "@/lib/api-auth";
import { listPublicCollections } from "@/lib/collections-data";

export async function GET(req: Request) {
  const auth = await validateApiKey(req.headers.get("authorization"));
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (!hasScope(auth.scopes, "collections:read")) {
    return NextResponse.json({ error: "Insufficient scope" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const result = await listPublicCollections(page);

  return NextResponse.json({
    data: result.items,
    meta: { page: result.page, pages: result.pages, total: result.total },
  });
}
