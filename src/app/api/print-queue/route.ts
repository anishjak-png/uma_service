import { NextResponse } from "next/server";

/** Polling removed — Print Bridge uses Supabase Realtime. */
export async function GET() {
  return NextResponse.json(
    {
      error:
        "Polling disabled. Use the Windows Print Bridge with Supabase Realtime (npm run print-bridge).",
    },
    { status: 410 }
  );
}
