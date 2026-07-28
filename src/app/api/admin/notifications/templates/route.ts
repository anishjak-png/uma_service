import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { NOTIFICATION_EVENT_TYPES } from "@/lib/notifications/types";
import {
  ensureDefaultTemplates,
  updateTemplate,
} from "@/lib/notifications/settings-store";
import type { NotificationEventType } from "@prisma/client";

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const templates = await ensureDefaultTemplates();
  return NextResponse.json({
    templates: NOTIFICATION_EVENT_TYPES.map((eventType) => ({
      eventType,
      body: templates[eventType].body,
    })),
  });
}

export async function PATCH(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await request.json();
  const eventType = body.eventType as NotificationEventType;
  const templateBody = body.body;

  if (!NOTIFICATION_EVENT_TYPES.includes(eventType)) {
    return NextResponse.json({ error: "Invalid event type" }, { status: 400 });
  }

  if (typeof templateBody !== "string" || !templateBody.trim()) {
    return NextResponse.json({ error: "Template body is required" }, { status: 400 });
  }

  const updated = await updateTemplate(eventType, templateBody);
  return NextResponse.json(updated);
}
