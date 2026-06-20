import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getNavUser } from "@/lib/nav-user";
import { ensurePrismaUser, findAppUserBySupabaseId } from "@/lib/user-sync";
import { invalidateUserSessionCache } from "@/lib/auth-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    let user = await getNavUser();
    if (user) return NextResponse.json(user);

    const session = await getSession();
    if (!session) return NextResponse.json(null);

    invalidateUserSessionCache(session.id);

    let dbUser = await findAppUserBySupabaseId(session.id);
    if (!dbUser) {
      dbUser = await ensurePrismaUser(session);
    }

    if (!dbUser) return NextResponse.json({ sessionActive: true, prismaLinked: false });

    user = await getNavUser();
    return NextResponse.json(user);
  } catch (error) {
    console.error("[api/auth/me]", error);

    const session = await getSession();
    if (!session) return NextResponse.json(null);

    try {
      const dbUser = await findAppUserBySupabaseId(session.id);
      if (dbUser) {
        const user = await getNavUser();
        if (user) return NextResponse.json(user);
      }
    } catch {
      /* fall through */
    }

    return NextResponse.json({ sessionActive: true, prismaLinked: false });
  }
}
