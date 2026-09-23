import { NextRequest, NextResponse } from "next/server";
import { JobStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { canDeleteJob, requireAdmin } from "@/lib/auth";
import { staffActorName } from "@/lib/jobs";
import { DELETED_JOB_STATUS, isDeletedStatus } from "@/lib/job-lifecycle";
import { getJobPatchSelect } from "@/lib/job-selects";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await requireAdmin();
  if (!session || !canDeleteJob(session.role)) {
    return NextResponse.json({ error: "Only admin can delete a job" }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const reason =
    typeof body.reason === "string" ? body.reason.trim().replace(/\s+/g, " ") : "";

  if (reason.length < 3) {
    return NextResponse.json(
      { error: "Enter a reason (at least 3 characters)" },
      { status: 400 }
    );
  }

  const existing = await prisma.jobCard.findFirst({
    where: { OR: [{ id }, { jobNumber: id }] },
    select: { id: true, jobNumber: true, status: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (isDeletedStatus(existing.status)) {
    return NextResponse.json(
      { error: "This job is already deleted" },
      { status: 409 }
    );
  }

  const deletedBy = staffActorName(session);
  const deletedAt = new Date();

  const job = await prisma.jobCard.update({
    where: { id: existing.id },
    data: {
      status: JobStatus.Deleted,
      deletedAt,
      deletedBy,
      deleteReason: reason,
      statusHistory: {
        create: {
          status: JobStatus.Deleted,
          changedBy: deletedBy,
          note: `Deleted: ${reason}`,
        },
      },
    },
    select: getJobPatchSelect(),
  });

  return NextResponse.json({
    ...job,
    jobNumber: existing.jobNumber,
    deletedAt: deletedAt.toISOString(),
    deletedBy,
    deleteReason: reason,
    statusHistoryEntry: {
      status: DELETED_JOB_STATUS,
      note: `Deleted: ${reason}`,
      changedBy: deletedBy,
      changedAt: deletedAt.toISOString(),
    },
  });
}
