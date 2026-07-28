import { prisma } from "@/lib/db";
import { normalizeMobile } from "@/lib/jobs";
import type { NotificationEventType } from "@prisma/client";
import {
  buildTemplateVariables,
  cleanupRenderedMessage,
} from "./job-context";
import {
  buildMetaTemplatePayload,
} from "./meta-template-config";
import { getMetaTemplateLanguageCode } from "./providers/meta/constants";
import { getWhatsAppProvider } from "./providers";
import {
  getNotificationSettings,
  getTemplateForEvent,
} from "./settings-store";
import { renderTemplate } from "./template-engine";
import {
  getWhatsAppSkipReason,
  resolveWhatsAppAllowed,
} from "./preference";
import type {
  NotificationProcessResult,
  MetaTemplatePayload,
  WhatsAppSendResult,
} from "./types";
import type { WhatsAppProviderType } from "@prisma/client";

const PROVIDER_LABELS: Record<WhatsAppProviderType, string> = {
  meta: "Meta Cloud API",
  interakt: "Interakt",
  twilio: "Twilio",
  custom: "Custom API",
};

function logNotificationSkip(reason: string, context: Record<string, unknown>) {
  console.log("[Notification] Skipped —", reason, context);
}

function logNotificationError(reason: string, context: Record<string, unknown>) {
  console.log("[Notification] Error", { reason, ...context });
}

function isEventEnabled(
  eventType: NotificationEventType,
  settings: Awaited<ReturnType<typeof getNotificationSettings>>
): boolean {
  switch (eventType) {
    case "JOB_CREATED":
      return settings.jobCreatedEnabled;
    case "JOB_READY":
      return settings.jobReadyEnabled;
    case "JOB_RETURN":
      return settings.jobReturnEnabled;
    default:
      return false;
  }
}

function buildMetaNotificationLogFields(params: {
  messageBody: string;
  result: WhatsAppSendResult;
}): { messageBody: string; error: string | null } {
  const { messageBody, result } = params;
  const debug = result.debug;

  if (!debug) {
    return { messageBody, error: result.error ?? null };
  }

  const logMessageBody = [
    messageBody,
    "",
    "[Meta API Debug]",
    JSON.stringify(
      {
        template: debug.templateName,
        recipient: debug.recipient,
        request: debug.requestPayload,
        response: debug.responsePayload,
        executionTimeMs: debug.executionTimeMs,
        httpStatus: debug.httpStatus,
        sentAt: debug.sentAt,
      },
      null,
      2
    ),
  ].join("\n");

  return {
    messageBody: logMessageBody,
    error: result.success
      ? null
      : debug.logError ?? debug.staffError ?? result.error ?? null,
  };
}

function buildNotificationLogFields(params: {
  messageBody: string;
  result: WhatsAppSendResult;
  provider: WhatsAppProviderType;
}): { messageBody: string; error: string | null } {
  if (params.provider === "meta") {
    return buildMetaNotificationLogFields(params);
  }
  return {
    messageBody: params.messageBody,
    error: params.result.error ?? null,
  };
}

async function hasAutomatedSend(
  jobId: string,
  eventType: NotificationEventType
): Promise<boolean> {
  const existing = await prisma.notificationLog.findFirst({
    where: {
      jobCardId: jobId,
      eventType,
      channel: "WHATSAPP",
      manual: false,
      status: "Sent",
    },
  });
  return Boolean(existing);
}

export async function sendWhatsAppNotification(params: {
  jobId: string;
  eventType: NotificationEventType;
  manual?: boolean;
}): Promise<NotificationProcessResult> {
  const { jobId, eventType, manual = false } = params;

  const [settings, job] = await Promise.all([
    getNotificationSettings(),
    prisma.jobCard.findUnique({
      where: { id: jobId },
      include: { customer: true },
    }),
  ]);

  if (!job) {
    logNotificationSkip("Job not found", { jobId, eventType });
    return { sent: false, skipped: true, error: "Job not found" };
  }

  const mobile = normalizeMobile(job.customer.mobile);
  if (mobile.length !== 10) {
    logNotificationError("Invalid customer mobile number", {
      jobId,
      eventType,
      mobile: job.customer.mobile,
    });
    const log = await prisma.notificationLog.create({
      data: {
        jobCardId: jobId,
        eventType,
        channel: "WHATSAPP",
        status: "Failed",
        recipient: job.customer.mobile,
        provider: settings.provider,
        manual,
        error: "Invalid customer mobile number",
      },
    });
    return {
      sent: false,
      skipped: false,
      error: "Invalid customer mobile number",
      logId: log.id,
    };
  }

  if (manual) {
    const manualAllowed = resolveWhatsAppAllowed({
      customerAllows: job.customer.allowWhatsappNotifications,
      jobOverride: job.whatsappNotificationsOverride,
      manual: true,
    });
    if (!manualAllowed) {
      const skipReason = getWhatsAppSkipReason({
        customerAllows: job.customer.allowWhatsappNotifications,
        jobOverride: job.whatsappNotificationsOverride,
        manual: false,
      });
      logNotificationSkip(skipReason ?? "WhatsApp disabled for this job", {
        jobId,
        eventType,
        manual: true,
      });
      const log = await prisma.notificationLog.create({
        data: {
          jobCardId: jobId,
          eventType,
          channel: "WHATSAPP",
          status: "Skipped",
          recipient: mobile,
          provider: settings.provider,
          manual: true,
          error: skipReason ?? "WhatsApp disabled for this job",
        },
      });
      return {
        sent: false,
        skipped: true,
        error: skipReason ?? "WhatsApp disabled for this job",
        logId: log.id,
      };
    }
  }

  if (!manual) {
    const preferenceAllowed = resolveWhatsAppAllowed({
      customerAllows: job.customer.allowWhatsappNotifications,
      jobOverride: job.whatsappNotificationsOverride,
      manual: false,
    });

    if (!preferenceAllowed) {
      const skipReason = getWhatsAppSkipReason({
        customerAllows: job.customer.allowWhatsappNotifications,
        jobOverride: job.whatsappNotificationsOverride,
        manual: false,
      });
      logNotificationSkip(skipReason ?? "WhatsApp notifications disabled by preference", {
        jobId,
        eventType,
      });
      const log = await prisma.notificationLog.create({
        data: {
          jobCardId: jobId,
          eventType,
          channel: "WHATSAPP",
          status: "Skipped",
          recipient: mobile,
          provider: settings.provider,
          manual: false,
          error: skipReason ?? "WhatsApp notifications disabled by preference",
        },
      });
      return {
        sent: false,
        skipped: true,
        error: skipReason ?? "WhatsApp notifications disabled by preference",
        logId: log.id,
      };
    }

    if (!settings.masterEnabled) {
      logNotificationSkip("WhatsApp automation is disabled", { jobId, eventType });
      const log = await prisma.notificationLog.create({
        data: {
          jobCardId: jobId,
          eventType,
          channel: "WHATSAPP",
          status: "Skipped",
          recipient: mobile,
          provider: settings.provider,
          manual: false,
          error: "WhatsApp automation is disabled",
        },
      });
      return {
        sent: false,
        skipped: true,
        error: "WhatsApp automation is disabled",
        logId: log.id,
      };
    }

    if (!isEventEnabled(eventType, settings)) {
      logNotificationSkip(`${eventType} notifications are disabled`, {
        jobId,
        eventType,
      });
      const log = await prisma.notificationLog.create({
        data: {
          jobCardId: jobId,
          eventType,
          channel: "WHATSAPP",
          status: "Skipped",
          recipient: mobile,
          provider: settings.provider,
          manual: false,
          error: `${eventType} notifications are disabled`,
        },
      });
      return {
        sent: false,
        skipped: true,
        error: `${eventType} notifications are disabled`,
        logId: log.id,
      };
    }

    if (eventType === "JOB_READY" && (await hasAutomatedSend(jobId, eventType))) {
      logNotificationSkip("Ready notification already sent for this job", {
        jobId,
        eventType,
      });
      const log = await prisma.notificationLog.create({
        data: {
          jobCardId: jobId,
          eventType,
          channel: "WHATSAPP",
          status: "Skipped",
          recipient: mobile,
          provider: settings.provider,
          manual: false,
          error: "Ready notification already sent for this job",
        },
      });
      return {
        sent: false,
        skipped: true,
        error: "Ready notification already sent for this job",
        logId: log.id,
      };
    }
  }

  let messageBody: string;
  let metaTemplate: MetaTemplatePayload | undefined;

  if (settings.provider === "meta") {
    const metaResult = buildMetaTemplatePayload(eventType, job, settings);
    if (!metaResult.ok) {
      logNotificationError(metaResult.error, { jobId, eventType });
      const log = await prisma.notificationLog.create({
        data: {
          jobCardId: jobId,
          eventType,
          channel: "WHATSAPP",
          status: "Failed",
          recipient: mobile,
          provider: settings.provider,
          manual,
          error: metaResult.error,
        },
      });
      return {
        sent: false,
        skipped: false,
        error: metaResult.error,
        logId: log.id,
      };
    }

    metaTemplate = metaResult.payload;
    messageBody = metaResult.messagePreview;
  } else {
    const templateBody = await getTemplateForEvent(eventType);
    const variables = buildTemplateVariables(job, settings);
    messageBody = cleanupRenderedMessage(
      renderTemplate(templateBody, variables)
    );
  }

  console.log(`[Notification] Provider = ${PROVIDER_LABELS[settings.provider]}`);
  if (metaTemplate) {
    console.log(`[Notification] Template = ${metaTemplate.templateName}`);
    console.log("[Notification] Meta payload params", {
      bodyVariableCount: metaTemplate.variables.length,
      bodyVariables: metaTemplate.variables,
      variableFormats: metaTemplate.variableFormats ?? null,
      urlButtonParameter: metaTemplate.urlButtonParameter ?? null,
      languageCode: getMetaTemplateLanguageCode(),
    });
  }
  console.log(`[Notification] Sending to ${mobile}`);

  const provider = getWhatsAppProvider(settings.provider);
  const result = await provider({
    to: mobile,
    message: messageBody,
    settings,
    metaTemplate,
  });

  if (settings.provider === "meta") {
    console.log("[Notification] Meta response", {
      success: result.success,
      externalId: result.externalId,
      error: result.error,
      httpStatus: result.debug?.httpStatus,
      metaErrorCode: result.debug?.metaErrorCode,
      metaErrorMessage: result.debug?.metaErrorMessage,
      requestPayload: result.debug?.requestPayload,
      responsePayload: result.debug?.responsePayload,
    });
  }

  const logFields = buildNotificationLogFields({
    messageBody,
    result,
    provider: settings.provider,
  });

  const log = await prisma.notificationLog.create({
    data: {
      jobCardId: jobId,
      eventType,
      channel: "WHATSAPP",
      status: result.success ? "Sent" : "Failed",
      recipient: mobile,
      messageBody: logFields.messageBody,
      provider: settings.provider,
      externalId: result.externalId,
      error: logFields.error,
      manual,
    },
  });

  if (!result.success) {
    logNotificationError(result.error ?? "WhatsApp send failed", {
      jobId,
      eventType,
      logId: log.id,
    });
    return {
      sent: false,
      skipped: false,
      error: result.error ?? "WhatsApp send failed",
      logId: log.id,
    };
  }

  console.log("[Notification] Sent successfully", { jobId, eventType, logId: log.id });
  return { sent: true, skipped: false, logId: log.id };
}

export function inferEventTypeFromJobStatus(
  status: string
): NotificationEventType | null {
  switch (status) {
    case "Pending":
    case "WaitingForCustomerApproval":
      return "JOB_CREATED";
    case "Ready":
      return "JOB_READY";
    case "Return":
      return "JOB_RETURN";
    default:
      return null;
  }
}
