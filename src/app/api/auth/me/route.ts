import { NextResponse } from "next/server";
import { getNavUser } from "@/lib/nav-user";

export async function GET() {
  const user = await getNavUser();
  return NextResponse.json(user);
}
