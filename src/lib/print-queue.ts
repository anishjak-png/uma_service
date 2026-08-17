import { Prisma, PrintJobStatus } from "@prisma/client";
import { prisma } from "./db";

export type SalePrintPayload = {
  billNo: string;
  date: string;
  items: Array<{
    name: string;
    code: string;
    qty: number;
    unit_price: number;
    line_total: number;
  }>;
  total: number;
};

const DEFAULT_BRANCH_ID = process.env.PRINT_BRANCH_ID?.trim() || "main";
const DEFAULT_PRINTER_ID = process.env.PRINT_PRINTER_ID?.trim() || "counter-1";

export async function enqueueReceiptPrint(
  jobCardId: string,
  options?: { reprint?: boolean }
) {
  const reprint = options?.reprint ?? false;

  if (reprint) {
    await prisma.printJob.updateMany({
      where: {
        jobCardId,
        type: "receipt",
        status: { in: ["Pending", "Printing"] },
      },
      data: {
        status: "Failed",
        errorMessage: "Superseded by new print request",
      },
    });
  } else {
    const existing = await prisma.printJob.findFirst({
      where: {
        jobCardId,
        type: "receipt",
        status: { in: ["Pending", "Printing"] },
      },
      select: { id: true },
    });

    if (existing) {
      return prisma.printJob.findUniqueOrThrow({ where: { id: existing.id } });
    }
  }

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

export async function enqueueSalePrint(
  payload: SalePrintPayload,
  options?: { reprint?: boolean; supersedeId?: string }
) {
  if (options?.reprint && options.supersedeId) {
    await prisma.printJob.updateMany({
      where: {
        id: options.supersedeId,
        type: "sale",
        status: { in: ["Pending", "Printing"] },
      },
      data: {
        status: "Failed",
        errorMessage: "Superseded by new print request",
      },
    });
  }

  return prisma.printJob.create({
    data: {
      jobCardId: null,
      type: "sale",
      payload: payload as Prisma.InputJsonValue,
      status: "Pending",
      branchId: DEFAULT_BRANCH_ID,
      printerId: DEFAULT_PRINTER_ID,
    },
  });
}

export async function getSalePrintStatus(id: string) {
  return prisma.printJob.findUnique({
    where: { id },
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
  job: {
    status: PrintJobStatus;
    attempts: number;
    errorMessage: string | null;
    printedAt: Date | null;
  } | null
): PrintStatusResponse | null {
  if (!job) return null;
  return {
    status: job.status,
    attempts: job.attempts,
    errorMessage: job.errorMessage,
    printedAt: job.printedAt?.toISOString() ?? null,
  };
}
