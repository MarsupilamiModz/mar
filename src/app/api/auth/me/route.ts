import { NextResponse } from "next/server";
import { getNavUser } from "@/lib/nav-user";

export async function GET() {
  try {
    const user = await getNavUser();
    return NextResponse.json(user);
  } catch (error) {
    console.error("[api/auth/me]", error);
    return NextResponse.json(null);
  }
}
