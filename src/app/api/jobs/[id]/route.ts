import { NextRequest, NextResponse } from "next/server";
import { JobStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { recordStatusChange } from "@/lib/jobs";
import { getSession } from "@/lib/session";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  const job = await prisma.jobCard.findFirst({
    where: { OR: [{ id }, { jobNumber: id }] },
    include: {
      customer: true,
      assignedTechnician: true,
      attendedTechnician: true,
      statusHistory: { orderBy: { changedAt: "desc" } },
    },
  });

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json(job);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await getSession();
    const { id } = await context.params;
    const body = await request.json();

    const existing = await prisma.jobCard.findFirst({
      where: { OR: [{ id }, { jobNumber: id }] },
    });

    if (!existing) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    const changedBy = session.role ?? "staff";

    if (body.status) {
      const newStatus = body.status as JobStatus;
      data.status = newStatus;

      if (newStatus === "Ready") {
        data.readyAt = new Date();
        if (body.finalCost != null) data.finalCost = parseFloat(body.finalCost);
        data.readyWhatsappSent = false;
        data.readyWhatsappSentAt = null;
      }

      if (newStatus === "Delivered") {
        if (!body.deliverySignature) {
          return NextResponse.json(
            { error: "Customer signature required for delivery" },
            { status: 400 }
          );
        }
        data.deliveredAt = new Date();
        data.deliverySignature = body.deliverySignature;
        data.deliveredBy = changedBy;
        data.receiptSlipReturned = body.receiptSlipReturned === true;
        data.deliveryNote = body.deliveryNote?.trim() || null;

        await recordStatusChange(
          existing.id,
          newStatus,
          changedBy,
          body.note ?? "Delivered — customer signature captured"
        );
      } else {
        await recordStatusChange(
          existing.id,
          newStatus,
          changedBy,
          body.note ?? undefined
        );
      }
    }

    if (body.finalCost != null && body.status !== "Ready") {
      data.finalCost = parseFloat(body.finalCost);
    }

    if (body.internalNotes != null) {
      data.internalNotes = body.internalNotes;
    }

    if (body.attendedTechnicianId != null) {
      data.attendedTechnicianId = body.attendedTechnicianId || null;
    }

    if (body.assignedTechnicianId != null) {
      data.assignedTechnicianId = body.assignedTechnicianId || null;
    }

    if (body.readyWhatsappSent === true) {
      data.readyWhatsappSent = true;
      data.readyWhatsappSentAt = new Date();
    }

    const job = await prisma.jobCard.update({
      where: { id: existing.id },
      data,
      include: {
        customer: true,
        assignedTechnician: true,
        attendedTechnician: true,
        statusHistory: { orderBy: { changedAt: "desc" } },
      },
    });

    return NextResponse.json(job);
  } catch (error) {
    console.error("PATCH /api/jobs/[id] failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to update job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
