import { NextRequest, NextResponse } from "next/server";
import {
  markPrintJobFailed,
  markPrintJobPrinted,
  markPrintJobPrinting,
} from "@/lib/print-queue";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.json();

  if (body.status === "printing") {
    await markPrintJobPrinting(id);
    return NextResponse.json({ ok: true });
  }

  if (body.status === "done" || body.status === "printed") {
    await markPrintJobPrinted(id);
    return NextResponse.json({ ok: true });
  }

  if (body.status === "failed") {
    const errorMessage =
      typeof body.error === "string" ? body.error : "Print failed";
    await markPrintJobFailed(id, errorMessage);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid status" }, { status: 400 });
}
