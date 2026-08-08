import { prisma } from "@/lib/db";
import type { NotificationEventType } from "@prisma/client";
import { formatMobileDisplay } from "@/lib/jobs";
import { getNotificationSettings } from "@/lib/notifications/settings-store";
import { sendMetaTextMessage } from "@/lib/notifications/providers/meta/send-text-message";
import { ACTIVE_JOB_STATUSES } from "@/lib/prisma-statuses";

const MESSAGE_PAGE_SIZE = 50;

const AUTOMATED_EVENT_LABELS: Record<NotificationEventType, string> = {
  JOB_CREATED: "Job created",
  JOB_READY: "Ready for delivery",
  JOB_RETURN: "Return",
};

export type InboxThreadMessage = {
  id: string;
  source: "chat" | "automated";
  direction: "inbound" | "outbound";
  messageType: string;
  body: string | null;
  status: string;
  createdAt: string;
  jobCard?: { id: string; jobNumber: string; status?: string } | null;
  automatedLabel?: string;
};

function stripMetaDebugFromLogBody(messageBody: string | null): string {
  if (!messageBody) return "";
  const debugIdx = messageBody.indexOf("\n\n[Meta API Debug]");
  return debugIdx >= 0 ? messageBody.slice(0, debugIdx).trim() : messageBody.trim();
}

function formatAutomatedLogPreview(
  eventType: NotificationEventType,
  messageBody: string | null
): string {
  const raw = stripMetaDebugFromLogBody(messageBody);
  if (!raw) return AUTOMATED_EVENT_LABELS[eventType];

  const withoutTemplatePrefix = raw.replace(/^\[[^\]]+\]\s*/, "");
  return withoutTemplatePrefix || AUTOMATED_EVENT_LABELS[eventType];
}

async function fetchAutomatedMessagesForMobile(
  customerMobile: string
): Promise<InboxThreadMessage[]> {
  const logs = await prisma.notificationLog.findMany({
    where: {
      channel: "WHATSAPP",
      status: "Sent",
      OR: [
        { recipient: customerMobile },
        { jobCard: { customer: { mobile: customerMobile } } },
      ],
    },
    include: {
      jobCard: {
        select: { id: true, jobNumber: true, status: true },
      },
    },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  return logs.map((log) => ({
    id: `automated-${log.id}`,
    source: "automated" as const,
    direction: "outbound" as const,
    messageType: "text",
    body: formatAutomatedLogPreview(log.eventType, log.messageBody),
    status: log.status,
    createdAt: log.createdAt.toISOString(),
    jobCard: log.jobCard,
    automatedLabel: AUTOMATED_EVENT_LABELS[log.eventType],
  }));
}

function mergeThreadMessages(
  chatMessages: InboxThreadMessage[],
  automatedMessages: InboxThreadMessage[]
): InboxThreadMessage[] {
  return [...chatMessages, ...automatedMessages].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

export async function listWhatsAppConversations() {
  const rows = await prisma.whatsAppConversation.findMany({
    orderBy: { lastMessageAt: "desc" },
    take: 100,
    include: {
      customer: { select: { id: true, name: true, mobile: true } },
    },
  });

  const enriched = await Promise.all(
    rows.map(async (row) => {
      let latestJob: {
        id: string;
        jobNumber: string;
        status: string;
      } | null = null;

      if (row.customerId) {
        latestJob = await prisma.jobCard.findFirst({
          where: {
            customerId: row.customerId,
            status: { in: ACTIVE_JOB_STATUSES },
          },
          orderBy: { receivedAt: "desc" },
          select: { id: true, jobNumber: true, status: true },
        });
      }

      return {
        id: row.id,
        customerMobile: row.customerMobile,
        mobileDisplay: formatMobileDisplay(row.customerMobile),
        customerName: row.customer?.name ?? null,
        customerId: row.customerId,
        lastMessageAt: row.lastMessageAt.toISOString(),
        lastMessagePreview: row.lastMessagePreview,
        unreadCount: row.unreadCount,
        latestJob,
      };
    })
  );

  const totalUnread = enriched.reduce((sum, c) => sum + c.unreadCount, 0);

  return { conversations: enriched, totalUnread };
}

export async function getWhatsAppMessages(
  conversationId: string,
  page = 1
) {
  const conversation = await prisma.whatsAppConversation.findUnique({
    where: { id: conversationId },
    include: {
      customer: { select: { id: true, name: true, mobile: true } },
    },
  });

  if (!conversation) return null;

  const skip = (Math.max(1, page) - 1) * MESSAGE_PAGE_SIZE;

  const [chatRows, chatTotal, automatedMessages] = await Promise.all([
    prisma.whatsAppMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      skip,
      take: MESSAGE_PAGE_SIZE,
      select: {
        id: true,
        direction: true,
        messageType: true,
        body: true,
        status: true,
        jobCardId: true,
        createdAt: true,
        jobCard: {
          select: { id: true, jobNumber: true, status: true },
        },
      },
    }),
    prisma.whatsAppMessage.count({ where: { conversationId } }),
    fetchAutomatedMessagesForMobile(conversation.customerMobile),
  ]);

  const chatMessages: InboxThreadMessage[] = chatRows.map((m) => ({
    id: m.id,
    source: "chat",
    direction: m.direction,
    messageType: m.messageType,
    body: m.body,
    status: m.status,
    createdAt: m.createdAt.toISOString(),
    jobCard: m.jobCard,
  }));

  const messages =
    page === 1
      ? mergeThreadMessages(chatMessages, automatedMessages)
      : chatMessages;

  let latestJob: {
    id: string;
    jobNumber: string;
    status: string;
  } | null = null;

  if (conversation.customerId) {
    latestJob = await prisma.jobCard.findFirst({
      where: {
        customerId: conversation.customerId,
        status: { in: ACTIVE_JOB_STATUSES },
      },
      orderBy: { receivedAt: "desc" },
      select: { id: true, jobNumber: true, status: true },
    });
  }

  return {
    conversation: {
      id: conversation.id,
      customerMobile: conversation.customerMobile,
      mobileDisplay: formatMobileDisplay(conversation.customerMobile),
      customerName: conversation.customer?.name ?? null,
      customerId: conversation.customerId,
      unreadCount: conversation.unreadCount,
      latestJob,
    },
    messages,
    page,
    totalPages: Math.max(1, Math.ceil(chatTotal / MESSAGE_PAGE_SIZE)),
    total: chatTotal + (page === 1 ? automatedMessages.length : 0),
  };
}

export async function markWhatsAppConversationRead(conversationId: string) {
  const updated = await prisma.whatsAppConversation.updateMany({
    where: { id: conversationId },
    data: { unreadCount: 0 },
  });
  return updated.count > 0;
}

export async function sendWhatsAppReply(params: {
  conversationId: string;
  body: string;
  staffUserId: string;
}) {
  const conversation = await prisma.whatsAppConversation.findUnique({
    where: { id: params.conversationId },
    include: {
      customer: { select: { id: true } },
    },
  });

  if (!conversation) {
    return { ok: false as const, error: "Conversation not found" };
  }

  const text = params.body.trim();
  if (!text) {
    return { ok: false as const, error: "Message body is empty" };
  }

  const settings = await getNotificationSettings();
  if (settings.provider !== "meta") {
    return {
      ok: false as const,
      error: "WhatsApp inbox replies require Meta Cloud API provider",
    };
  }

  const result = await sendMetaTextMessage({
    settings,
    to: conversation.customerMobile,
    body: text,
  });

  if (!result.success || !result.externalId) {
    return {
      ok: false as const,
      error: result.error ?? result.debug?.staffError ?? "Failed to send message",
    };
  }

  const jobCardId = conversation.customerId
    ? (
        await prisma.jobCard.findFirst({
          where: {
            customerId: conversation.customerId,
            status: { in: ACTIVE_JOB_STATUSES },
          },
          orderBy: { receivedAt: "desc" },
          select: { id: true },
        })
      )?.id ?? null
    : null;

  const preview = text.slice(0, 120);
  const now = new Date();

  const message = await prisma.$transaction(async (tx) => {
    await tx.whatsAppConversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: now,
        lastMessagePreview: preview,
      },
    });

    return tx.whatsAppMessage.create({
      data: {
        conversationId: conversation.id,
        direction: "outbound",
        wamid: result.externalId!,
        messageType: "text",
        body: text,
        status: "sent",
        sentByStaffUserId: params.staffUserId,
        jobCardId,
      },
      select: {
        id: true,
        direction: true,
        messageType: true,
        body: true,
        status: true,
        createdAt: true,
      },
    });
  });

  return {
    ok: true as const,
    message: {
      ...message,
      createdAt: message.createdAt.toISOString(),
    },
  };
}
