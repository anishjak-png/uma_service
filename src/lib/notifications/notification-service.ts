import type { NotificationEventType } from "@prisma/client";
import type { NotificationEventPayload, NotificationProcessResult } from "./types";
import { sendWhatsAppNotification } from "./whatsapp-service";

/**
 * Notification service entry point.
 * V1 routes all events to WhatsApp; future channels (SMS, Email, Push) plug in here.
 */
export async function processNotificationEvent(
  payload: NotificationEventPayload
): Promise<NotificationProcessResult> {
  const { type, jobId, manual = false } = payload;

  console.log("[Notification] Processing event", { type, jobId, manual });

  switch (type) {
    case "JOB_CREATED":
    case "JOB_READY":
    case "JOB_RETURN":
      return sendWhatsAppNotification({ jobId, eventType: type, manual });
    default:
      return { sent: false, skipped: true, error: `Unsupported event: ${type}` };
  }
}

export async function processManualWhatsApp(params: {
  jobId: string;
  eventType: NotificationEventType;
}): Promise<NotificationProcessResult> {
  return processNotificationEvent({
    type: params.eventType,
    jobId: params.jobId,
    manual: true,
  });
}
