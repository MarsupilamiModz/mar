import { NextResponse } from "next/server";
import { logPlatformError } from "@/lib/platform-log";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const message = typeof body.message === "string" ? body.message : "Client error";
    const context = typeof body.context === "string" ? body.context : "client";
    const digest = typeof body.digest === "string" ? body.digest : undefined;
    const route = typeof body.route === "string" ? body.route : undefined;

    await logPlatformError(
      `${context}${route ? `:${route}` : ""}${digest ? `:${digest}` : ""}`,
      new Error(message)
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
