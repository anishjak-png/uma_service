import { NextRequest, NextResponse } from "next/server";
import { loadJobBoardCounts } from "@/lib/job-board-counts";
import { getSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const counts = await loadJobBoardCounts(
    session,
    request.nextUrl.searchParams.get("scope")
  );
  return NextResponse.json(counts);
}
