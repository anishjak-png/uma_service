import { prisma } from "@/lib/db";
import type { NotificationEventType } from "@prisma/client";
import { DEFAULT_TEMPLATE_BODIES } from "./default-templates";
import type { NotificationSettingsDto } from "./types";

export async function getNotificationSettings(): Promise<NotificationSettingsDto> {
  const row = await prisma.notificationSettings.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });

  return {
    masterEnabled: row.masterEnabled,
    jobCreatedEnabled: row.jobCreatedEnabled,
    jobReadyEnabled: row.jobReadyEnabled,
    jobReturnEnabled: row.jobReturnEnabled,
    trackingLinkEnabled: row.trackingLinkEnabled,
    provider: row.provider,
    apiUrl: row.apiUrl,
    apiKey: row.apiKey,
    accessToken: row.accessToken,
    phoneNumberId: row.phoneNumberId,
    whatsappBusinessAccountId: row.whatsappBusinessAccountId,
    businessNumber: row.businessNumber,
    additionalHeaders: row.additionalHeaders,
  };
}

export async function updateNotificationSettings(
  data: Partial<NotificationSettingsDto>
): Promise<NotificationSettingsDto> {
  const clean = Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined)
  );

  const row = await prisma.notificationSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      ...clean,
    },
    update: clean,
  });

  return {
    masterEnabled: row.masterEnabled,
    jobCreatedEnabled: row.jobCreatedEnabled,
    jobReadyEnabled: row.jobReadyEnabled,
    jobReturnEnabled: row.jobReturnEnabled,
    trackingLinkEnabled: row.trackingLinkEnabled,
    provider: row.provider,
    apiUrl: row.apiUrl,
    apiKey: row.apiKey,
    accessToken: row.accessToken,
    phoneNumberId: row.phoneNumberId,
    whatsappBusinessAccountId: row.whatsappBusinessAccountId,
    businessNumber: row.businessNumber,
    additionalHeaders: row.additionalHeaders,
  };
}

export async function ensureDefaultTemplates(): Promise<
  Record<NotificationEventType, { eventType: NotificationEventType; body: string }>
> {
  const existing = await prisma.notificationTemplate.findMany();
  const byType = new Map(existing.map((t) => [t.eventType, t]));

  for (const eventType of Object.keys(
    DEFAULT_TEMPLATE_BODIES
  ) as NotificationEventType[]) {
    if (!byType.has(eventType)) {
      const created = await prisma.notificationTemplate.create({
        data: {
          eventType,
          body: DEFAULT_TEMPLATE_BODIES[eventType],
        },
      });
      byType.set(eventType, created);
    }
  }

  return Object.fromEntries(
    [...byType.entries()].map(([eventType, row]) => [
      eventType,
      { eventType: row.eventType, body: row.body },
    ])
  ) as Record<
    NotificationEventType,
    { eventType: NotificationEventType; body: string }
  >;
}

export async function getTemplateForEvent(
  eventType: NotificationEventType
): Promise<string> {
  await ensureDefaultTemplates();
  const row = await prisma.notificationTemplate.findUnique({
    where: { eventType },
  });
  return row?.body ?? DEFAULT_TEMPLATE_BODIES[eventType];
}

export async function updateTemplate(
  eventType: NotificationEventType,
  body: string
): Promise<{ eventType: NotificationEventType; body: string }> {
  await ensureDefaultTemplates();
  const row = await prisma.notificationTemplate.update({
    where: { eventType },
    data: { body },
  });
  return { eventType: row.eventType, body: row.body };
}
