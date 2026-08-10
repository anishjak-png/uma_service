import { NextRequest, NextResponse } from "next/server";
import { JobStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  addCalendarDays,
  buildDeliveryCallHistoryNote,
  type DeliveryCallOutcome,
} from "@/lib/delivery-contact";
import { staffActorName } from "@/lib/jobs";
import { getSession } from "@/lib/session";

type RouteContext = { params: Promise<{ id: string }> };

const PICKUP_STATUSES = new Set<JobStatus>(["Ready", "Return"]);

const OUTCOMES = new Set<DeliveryCallOutcome>([
  "coming_in",
  "no_answer",
  "not_reachable",
]);

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.role !== "reception" && session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    outcome?: string;
    days?: number;
  } | null;

  const outcome = body?.outcome as DeliveryCallOutcome | undefined;
  if (!outcome || !OUTCOMES.has(outcome)) {
    return NextResponse.json({ error: "Invalid call outcome" }, { status: 400 });
  }

  const existing = await prisma.jobCard.findFirst({
    where: { OR: [{ id }, { jobNumber: id }] },
    select: { id: true, status: true, jobNumber: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (!PICKUP_STATUSES.has(existing.status)) {
    return NextResponse.json(
      { error: "Delivery call log applies only to Ready or Return jobs" },
      { status: 400 }
    );
  }

  let expectedDeliveryAt: Date | null = null;
  let deliveryContactStatus: "not_contacted" | "contacted" = "not_contacted";

  if (outcome === "coming_in") {
    const days = Number(body?.days);
    if (!Number.isFinite(days) || days < 0 || days > 365 || !Number.isInteger(days)) {
      return NextResponse.json(
        { error: "Enter whole days (0–365) for expected pickup" },
        { status: 400 }
      );
    }
    expectedDeliveryAt = addCalendarDays(new Date(), days);
    deliveryContactStatus = "contacted";
  }

  const changedBy = staffActorName(session);
  const note = buildDeliveryCallHistoryNote(outcome, expectedDeliveryAt);

  const updateData: {
    deliveryContactStatus: "not_contacted" | "contacted";
    expectedDeliveryAt?: Date | null;
  } = { deliveryContactStatus };

  if (outcome === "coming_in") {
    updateData.expectedDeliveryAt = expectedDeliveryAt;
  }

  const [historyEntry, job] = await prisma.$transaction([
    prisma.statusHistory.create({
      data: {
        jobCardId: existing.id,
        status: existing.status,
        changedBy,
        note,
      },
    }),
    prisma.jobCard.update({
      where: { id: existing.id },
      data: updateData,
      select: {
        id: true,
        jobNumber: true,
        status: true,
        deliveryContactStatus: true,
        expectedDeliveryAt: true,
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    job: {
      ...job,
      expectedDeliveryAt: job.expectedDeliveryAt?.toISOString() ?? null,
    },
    historyEntry: {
      ...historyEntry,
      changedAt: historyEntry.changedAt.toISOString(),
    },
  });
}
