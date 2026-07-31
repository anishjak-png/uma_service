import { NextResponse } from "next/server";
import {
  enqueueReceiptPrint,
  getLatestPrintStatus,
  toPrintStatusResponse,
} from "@/lib/print-queue";
import { prisma } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

async function resolveJobCardId(id: string) {
  const job = await prisma.jobCard.findFirst({
    where: { OR: [{ id }, { jobNumber: id }] },
    select: { id: true },
  });
  return job?.id ?? null;
}

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const jobCardId = await resolveJobCardId(id);

  if (!jobCardId) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const printJob = await enqueueReceiptPrint(jobCardId);
  return NextResponse.json({
    printJobId: printJob.id,
    status: printJob.status,
  });
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const jobCardId = await resolveJobCardId(id);

  if (!jobCardId) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const status = await getLatestPrintStatus(jobCardId);
  return NextResponse.json(
    toPrintStatusResponse(status) ?? {
      status: "Pending",
      attempts: 0,
      errorMessage: null,
      printedAt: null,
    }
  );
}
