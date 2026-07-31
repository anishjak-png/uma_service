import { PrintJobStatus } from "@prisma/client";
import { prisma } from "./db";

const DEFAULT_BRANCH_ID = process.env.PRINT_BRANCH_ID?.trim() || "main";
const DEFAULT_PRINTER_ID = process.env.PRINT_PRINTER_ID?.trim() || "counter-1";

export async function enqueueReceiptPrint(jobCardId: string) {
  return prisma.printJob.create({
    data: {
      jobCardId,
      type: "receipt",
      status: "Pending",
      branchId: DEFAULT_BRANCH_ID,
      printerId: DEFAULT_PRINTER_ID,
    },
  });
}

export async function getLatestPrintStatus(jobCardId: string) {
  return prisma.printJob.findFirst({
    where: { jobCardId, type: "receipt" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      attempts: true,
      errorMessage: true,
      createdAt: true,
      printedAt: true,
    },
  });
}

export async function markPrintJobPrinting(id: string) {
  return prisma.printJob.update({
    where: { id },
    data: {
      status: "Printing",
      attempts: { increment: 1 },
    },
  });
}

export async function markPrintJobPrinted(id: string) {
  return prisma.printJob.update({
    where: { id },
    data: {
      status: "Printed",
      printedAt: new Date(),
      errorMessage: null,
    },
  });
}

export async function markPrintJobFailed(id: string, errorMessage: string) {
  return prisma.printJob.update({
    where: { id },
    data: {
      status: "Failed",
      errorMessage,
    },
  });
}

export type PrintStatusResponse = {
  status: PrintJobStatus;
  attempts: number;
  errorMessage: string | null;
  printedAt: string | null;
};

export function toPrintStatusResponse(
  job: Awaited<ReturnType<typeof getLatestPrintStatus>>
): PrintStatusResponse | null {
  if (!job) return null;
  return {
    status: job.status,
    attempts: job.attempts,
    errorMessage: job.errorMessage,
    printedAt: job.printedAt?.toISOString() ?? null,
  };
}
