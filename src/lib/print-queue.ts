import { PrintJobStatus } from "@prisma/client";
import { prisma } from "./db";

const MAX_ATTEMPTS = 3;

export async function enqueueReceiptPrint(jobCardId: string) {
  return prisma.printJob.create({
    data: {
      jobCardId,
      type: "receipt",
      status: "Pending",
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
      lastError: true,
      createdAt: true,
      printedAt: true,
    },
  });
}

export async function fetchPendingPrintJobs(limit = 10) {
  return prisma.printJob.findMany({
    where: {
      status: { in: ["Pending", "Failed"] },
      attempts: { lt: MAX_ATTEMPTS },
    },
    include: {
      jobCard: {
        include: { customer: true },
      },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
}

/** Atomically claim pending jobs so overlapping polls/agents cannot reprint the same receipt. */
export async function claimPendingPrintJobs(limit = 10) {
  const claimed: Awaited<ReturnType<typeof fetchPendingPrintJobs>> = [];

  for (let i = 0; i < limit; i++) {
    const next = await prisma.printJob.findFirst({
      where: {
        status: "Pending",
        attempts: { lt: MAX_ATTEMPTS },
      },
      orderBy: { createdAt: "asc" },
      include: {
        jobCard: {
          include: { customer: true },
        },
      },
    });

    if (!next) break;

    const updated = await prisma.printJob.updateMany({
      where: { id: next.id, status: "Pending" },
      data: {
        status: "Printing",
        attempts: { increment: 1 },
      },
    });

    if (updated.count === 1) {
      claimed.push(next);
    }
  }

  return claimed;
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

export async function markPrintJobDone(id: string) {
  return prisma.printJob.update({
    where: { id },
    data: {
      status: "Done",
      printedAt: new Date(),
      lastError: null,
    },
  });
}

export async function markPrintJobFailed(id: string, error: string) {
  const job = await prisma.printJob.findUnique({ where: { id } });
  if (!job) return null;

  const failed = job.attempts >= MAX_ATTEMPTS;
  return prisma.printJob.update({
    where: { id },
    data: {
      status: failed ? "Failed" : "Pending",
      lastError: error,
    },
  });
}

export function verifyPrintAgentKey(request: Request): boolean {
  const key = process.env.PRINT_AGENT_API_KEY;
  if (!key) return false;
  return request.headers.get("X-Print-Agent-Key") === key;
}

export type PrintStatusResponse = {
  status: PrintJobStatus;
  attempts: number;
  lastError: string | null;
  printedAt: string | null;
};

export function toPrintStatusResponse(
  job: Awaited<ReturnType<typeof getLatestPrintStatus>>
): PrintStatusResponse | null {
  if (!job) return null;
  return {
    status: job.status,
    attempts: job.attempts,
    lastError: job.lastError,
    printedAt: job.printedAt?.toISOString() ?? null,
  };
}
