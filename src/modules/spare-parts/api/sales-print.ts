import { NextResponse } from "next/server";
import { enqueueSalePrint, getSalePrintStatus, toPrintStatusResponse } from "@/lib/print-queue";
import { asErrorMessage, jsonError, requireSparePartsAdmin } from "../lib/http";
import { isSaleReceiptData } from "../lib/thermal-sale";

export async function GET(request: Request) {
  const unauthorized = await requireSparePartsAdmin();
  if (unauthorized) return unauthorized;
  const { searchParams } = new URL(request.url);
  const printJobId = searchParams.get("printJobId");
  if (!printJobId) return jsonError("printJobId is required");
  const status = await getSalePrintStatus(printJobId);
  return NextResponse.json(
    toPrintStatusResponse(status) ?? {
      status: "Pending",
      attempts: 0,
      errorMessage: null,
      printedAt: null,
    },
  );
}

export async function POST(request: Request) {
  const unauthorized = await requireSparePartsAdmin();
  if (unauthorized) return unauthorized;
  try {
    const body = (await request.json()) as { payload?: unknown; printJobId?: string };
    if (!isSaleReceiptData(body.payload)) return jsonError("Receipt payload is required");
    const printJob = await enqueueSalePrint(body.payload, {
      reprint: true,
      supersedeId: body.printJobId,
    });
    return NextResponse.json({ printJobId: printJob.id, status: printJob.status });
  } catch (error) {
    return jsonError(asErrorMessage(error), 500);
  }
}
