import { NextResponse } from "next/server";
import { getAdSettings } from "@/lib/ads";
import { buildAdsTxtLine, resolveAdsenseClientId, DEFAULT_ADS_TXT } from "@/lib/adsense-config";

/** Dynamic ads.txt — public/ads.txt takes precedence in static hosting; this route is a fallback. */
export async function GET() {
  try {
    const settings = await getAdSettings();
    const publisherId = resolveAdsenseClientId(settings);
    const body = `${buildAdsTxtLine(publisherId)}\n`;
    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new NextResponse(`${DEFAULT_ADS_TXT}\n`, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
