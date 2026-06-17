import { NextResponse } from "next/server";
import { trackAffiliateClick } from "@/actions/affiliate";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  const result = await trackAffiliateClick(code);
  const redirectTo = new URL(req.url).searchParams.get("redirect") ?? "/";

  const res = NextResponse.redirect(new URL(redirectTo, req.url));
  if (result.success) {
    res.cookies.set("mm_ref", code.toUpperCase(), {
      maxAge: 60 * 60 * 24 * 30,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  }
  return res;
}
