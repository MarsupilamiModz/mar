import { NextResponse } from "next/server";
import { validateApiKey, hasScope } from "@/lib/api-auth";
import { getCollectionBySlug } from "@/lib/collections-data";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const auth = await validateApiKey(_req.headers.get("authorization"));
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (!hasScope(auth.scopes, "collections:read")) {
    return NextResponse.json({ error: "Insufficient scope" }, { status: 403 });
  }

  const collection = await getCollectionBySlug(slug);
  if (!collection || collection.visibility === "PRIVATE") {
    return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  }

  return NextResponse.json({ data: collection });
}
