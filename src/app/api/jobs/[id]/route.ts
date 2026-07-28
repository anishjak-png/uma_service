import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { JobStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parseServiceAmount } from "@/lib/currency";
import { jobPatchSelect } from "@/lib/job-selects";
import {
  canDeliverJob,
  canEditCompletedBy,
  canEditDeliveredJob,
  canEditServiceAmount,
  canReopenDeliveredJob,
  isServiceAmountLocked,
} from "@/lib/auth";
import { getSession } from "@/lib/session";
import { dispatchNotificationEvent } from "@/lib/notifications/events";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  const job = await prisma.jobCard.findFirst({
    where: { OR: [{ id }, { jobNumber: id }] },
    include: {
      customer: true,
      assignedTechnician: true,
      completedByTechnician: true,
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
    if (!session.isLoggedIn || !session.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();

    const existing = await prisma.jobCard.findFirst({
      where: { OR: [{ id }, { jobNumber: id }] },
    });

    if (!existing) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (existing.status === "Delivered" && !canEditDeliveredJob(session.role)) {
      return NextResponse.json(
        { error: "Delivered jobs cannot be edited. Contact admin to reopen." },
        { status: 403 }
      );
    }

    const amountLocked = isServiceAmountLocked(existing);

    if (
      body.serviceAmount !== undefined &&
      !body.status &&
      !canEditServiceAmount(session.role)
    ) {
      return NextResponse.json(
        { error: "Only admin can edit service amount after job is marked Ready" },
        { status: 403 }
      );
    }

    const data: Record<string, unknown> = {};
    const changedBy =
      session.role === "technician" && session.technicianName
        ? session.technicianName
        : session.role;

    let statusChange: JobStatus | null = null;
    let statusNote: string | undefined;

    if (body.status) {
      const newStatus = body.status as JobStatus;

      if (existing.status === "Delivered" && newStatus !== "Delivered") {
        if (!canReopenDeliveredJob(session.role)) {
          return NextResponse.json(
            { error: "Only admin can reopen delivered jobs" },
            { status: 403 }
          );
        }
        data.deliveredAt = null;
      }

      if (newStatus === "Delivered" && !canDeliverJob(session.role)) {
        return NextResponse.json(
          { error: "Technicians cannot mark jobs as delivered" },
          { status: 403 }
        );
      }

      if (newStatus === "Ready") {
        if (amountLocked && !canEditServiceAmount(session.role)) {
          if (existing.serviceAmount == null) {
            return NextResponse.json(
              { error: "Service amount is required when marking Ready" },
              { status: 400 }
            );
          }
        } else {
          const amount = parseServiceAmount(body.serviceAmount);
          if (amount == null) {
            return NextResponse.json(
              { error: "Service amount is required when marking Ready" },
              { status: 400 }
            );
          }
          data.serviceAmount = amount;
        }
        if (!existing.readyAt) {
          data.readyAt = new Date();
        }

        if (!existing.completedByTechnicianId) {
          if (session.role === "technician" && session.technicianId) {
            data.completedByTechnicianId = session.technicianId;
          } else if (session.role === "reception" || session.role === "admin") {
            const completedById = body.completedByTechnicianId;
            if (!completedById || typeof completedById !== "string") {
              return NextResponse.json(
                { error: "Select the technician who completed the repair" },
                { status: 400 }
              );
            }
            const technician = await prisma.technician.findFirst({
              where: { id: completedById, active: true },
            });
            if (!technician) {
              return NextResponse.json(
                { error: "Invalid technician selected" },
                { status: 400 }
              );
            }
            data.completedByTechnicianId = completedById;
          }
        }
      }

      if (newStatus === "Return") {
        data.serviceAmount = 0;
      }

      data.status = newStatus;

      if (newStatus === "Delivered") {
        data.deliveredAt = new Date();
      }

      statusChange = newStatus;
      statusNote = body.note ?? undefined;
    }

    if (
      body.serviceAmount !== undefined &&
      !body.status &&
      canEditServiceAmount(session.role)
    ) {
      const amount = parseServiceAmount(body.serviceAmount);
      if (amount == null) {
        return NextResponse.json(
          { error: "Invalid service amount" },
          { status: 400 }
        );
      }
      data.serviceAmount = amount;
    }

    if (body.remarks != null) {
      data.remarks = body.remarks;
    }

    if (body.assignedTechnicianId != null && session.role !== "technician") {
      data.assignedTechnicianId = body.assignedTechnicianId || null;
    }

    if (body.completedByTechnicianId !== undefined) {
      if (!canEditCompletedBy(session.role)) {
        return NextResponse.json(
          { error: "Only admin can change completed by technician" },
          { status: 403 }
        );
      }
      data.completedByTechnicianId = body.completedByTechnicianId || null;
    }

    if (body.whatsappNotificationsOverride !== undefined) {
      if (session.role !== "reception" && session.role !== "admin") {
        return NextResponse.json({ error: "Not allowed" }, { status: 403 });
      }
      if (body.whatsappNotificationsOverride === null) {
        data.whatsappNotificationsOverride = null;
      } else {
        data.whatsappNotificationsOverride = Boolean(
          body.whatsappNotificationsOverride
        );
      }
    }

    const jobId = existing.id;

    if (statusChange) {
      const [statusHistoryEntry, job] = await prisma.$transaction([
        prisma.statusHistory.create({
          data: {
            jobCardId: jobId,
            status: statusChange,
            changedBy,
            note: statusNote,
          },
        }),
        prisma.jobCard.update({
          where: { id: jobId },
          data,
          select: jobPatchSelect,
        }),
      ]);

      if (statusChange === "Ready" && !existing.readyAt) {
        after(() =>
          dispatchNotificationEvent({ type: "JOB_READY", jobId })
        );
      }
      if (statusChange === "Return") {
        after(() =>
          dispatchNotificationEvent({ type: "JOB_RETURN", jobId })
        );
      }

      return NextResponse.json({ ...job, statusHistoryEntry });
    }

    const job = await prisma.jobCard.update({
      where: { id: jobId },
      data,
      select: jobPatchSelect,
    });

    return NextResponse.json(job);
  } catch (error) {
    console.error("PATCH /api/jobs/[id] failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to update job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
