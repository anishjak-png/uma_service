import { NextRequest, NextResponse } from "next/server";
import {
  markPrintJobDone,
  markPrintJobFailed,
  markPrintJobPrinting,
  verifyPrintAgentKey,
} from "@/lib/print-queue";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!verifyPrintAgentKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json();

  if (body.status === "printing") {
    await markPrintJobPrinting(id);
    return NextResponse.json({ ok: true });
  }

  if (body.status === "done") {
    await markPrintJobDone(id);
    return NextResponse.json({ ok: true });
  }

  if (body.status === "failed") {
    const error = typeof body.error === "string" ? body.error : "Print failed";
    await markPrintJobFailed(id, error);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid status" }, { status: 400 });
}
