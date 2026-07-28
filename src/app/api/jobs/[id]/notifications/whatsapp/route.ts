import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth";
import { NOTIFICATION_EVENT_TYPES } from "@/lib/notifications/types";
import {
  inferEventTypeFromJobStatus,
  sendWhatsAppNotification,
} from "@/lib/notifications/whatsapp-service";
import { prisma } from "@/lib/db";
import type { NotificationEventType } from "@prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await requireStaff(["reception", "admin"]);
  if (!session) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));

  const job = await prisma.jobCard.findFirst({
    where: { OR: [{ id }, { jobNumber: id }] },
    select: { id: true, status: true },
  });

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  let eventType = body.eventType as NotificationEventType | undefined;
  if (eventType && !NOTIFICATION_EVENT_TYPES.includes(eventType)) {
    return NextResponse.json({ error: "Invalid event type" }, { status: 400 });
  }

  if (!eventType) {
    eventType = inferEventTypeFromJobStatus(job.status) ?? undefined;
  }

  if (!eventType) {
    return NextResponse.json(
      {
        error:
          "No WhatsApp template applies to this job status. Specify eventType manually.",
      },
      { status: 400 }
    );
  }

  const result = await sendWhatsAppNotification({
    jobId: job.id,
    eventType,
    manual: true,
  });

  if (result.sent) {
    return NextResponse.json({
      ok: true,
      eventType,
      logId: result.logId,
      message: "WhatsApp message sent",
    });
  }

  return NextResponse.json(
    {
      ok: false,
      eventType,
      logId: result.logId,
      error: result.error ?? "WhatsApp send failed",
      skipped: result.skipped,
    },
    { status: result.skipped ? 200 : 502 }
  );
}
