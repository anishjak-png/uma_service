import type { NotificationEventPayload } from "./types";
import { processNotificationEvent } from "./notification-service";

/**
 * Fire-and-forget business event hook.
 * Business APIs should only call this — never WhatsApp providers directly.
 */
export function dispatchNotificationEvent(payload: NotificationEventPayload): void {
  console.log("[Notification] Dispatcher started", payload);
  processNotificationEvent(payload).catch((err) => {
    console.error("[Notification] Error", {
      type: payload.type,
      jobId: payload.jobId,
      err,
    });
  });
}

export async function dispatchNotificationEventAsync(
  payload: NotificationEventPayload
) {
  console.log("[Notification] Dispatcher started", payload);
  try {
    return await processNotificationEvent(payload);
  } catch (err) {
    console.error("[Notification] Error", {
      type: payload.type,
      jobId: payload.jobId,
      err,
    });
    throw err;
  }
}
