import { NextRequest, NextResponse } from "next/server";
import { purgeDeliveredPhotos } from "@/lib/purge-delivered-photos";

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await purgeDeliveredPhotos();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[cron purge-delivered-photos]", error);
    const message = error instanceof Error ? error.message : "Photo purge failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
