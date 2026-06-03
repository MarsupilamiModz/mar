import { NextResponse } from "next/server";
import { getSession, getCurrentUser } from "@/lib/auth";
import { getNavUser } from "@/lib/nav-user";
import { ensurePrismaUser } from "@/lib/user-sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    let user = await getNavUser();
    if (user) return NextResponse.json(user);

    const session = await getSession();
    if (!session) return NextResponse.json(null);

    await ensurePrismaUser(session);
    user = await getNavUser();
    return NextResponse.json(user);
  } catch (error) {
    console.error("[api/auth/me]", error);

    const session = await getSession();
    if (session) {
      const dbUser = await getCurrentUser();
      if (dbUser) {
        try {
          const user = await getNavUser();
          if (user) return NextResponse.json(user);
        } catch {
          /* fall through */
        }
      }
    }

    return NextResponse.json(null);
  }
}
