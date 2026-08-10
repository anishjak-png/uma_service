import { prisma } from "@/lib/db";
import type { NotificationEventType } from "@prisma/client";
import { formatMobileDisplay } from "@/lib/jobs";
import { getNotificationSettings } from "@/lib/notifications/settings-store";
import { sendMetaTextMessage } from "@/lib/notifications/providers/meta/send-text-message";
import { sendMetaImageMessage } from "@/lib/notifications/providers/meta/send-image-message";
import { uploadMetaMedia } from "@/lib/notifications/providers/meta/upload-media";
import { ACTIVE_JOB_STATUSES } from "@/lib/prisma-statuses";

const MESSAGE_PAGE_SIZE = 50;

const CHAT_MESSAGE_SELECT = {
  id: true,
  direction: true,
  messageType: true,
  body: true,
  mediaId: true,
  wamid: true,
  reactedToWamid: true,
  status: true,
  jobCardId: true,
  createdAt: true,
  jobCard: {
    select: { id: true, jobNumber: true, status: true },
  },
} as const;

const CHAT_MESSAGE_SELECT_LEGACY = {
  id: true,
  direction: true,
  messageType: true,
  body: true,
  mediaId: true,
  wamid: true,
  status: true,
  jobCardId: true,
  createdAt: true,
  jobCard: {
    select: { id: true, jobNumber: true, status: true },
  },
} as const;

function isSchemaDriftError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("reactedtowamid") ||
    msg.includes("unknown field") ||
    msg.includes("column") ||
    msg.includes("does not exist") ||
    msg.includes("deliverycontactstatus") ||
    msg.includes("expecteddeliveryat")
  );
}

async function fetchChatMessages(
  conversationId: string,
  skip: number,
  take: number
) {
  try {
    return await prisma.whatsAppMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      skip,
      take,
      select: CHAT_MESSAGE_SELECT,
    });
  } catch (err) {
    if (!isSchemaDriftError(err)) throw err;
    console.warn("[WhatsApp Inbox] Using legacy message query — run prisma db push");
    return prisma.whatsAppMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      skip,
      take,
      select: CHAT_MESSAGE_SELECT_LEGACY,
    });
  }
}

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
  mediaId?: string | null;
  wamid?: string | null;
  reactedToWamid?: string | null;
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
    wamid: log.externalId,
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
    fetchChatMessages(conversationId, skip, MESSAGE_PAGE_SIZE),
    prisma.whatsAppMessage.count({ where: { conversationId } }),
    fetchAutomatedMessagesForMobile(conversation.customerMobile),
  ]);

  const chatMessages: InboxThreadMessage[] = chatRows.map((m) => ({
    id: m.id,
    source: "chat",
    direction: m.direction,
    messageType: m.messageType,
    body: m.body,
    mediaId: m.mediaId,
    wamid: m.wamid,
    reactedToWamid:
      "reactedToWamid" in m ? (m.reactedToWamid as string | null) : null,
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

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export async function sendWhatsAppImageReply(params: {
  conversationId: string;
  file: { buffer: Buffer; mimeType: string; filename: string };
  caption?: string;
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

  const mimeType = params.file.mimeType.toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.has(mimeType)) {
    return { ok: false as const, error: "Only JPEG, PNG, and WebP images are supported" };
  }

  if (params.file.buffer.length > MAX_IMAGE_BYTES) {
    return { ok: false as const, error: "Image must be 5 MB or smaller" };
  }

  const settings = await getNotificationSettings();
  if (settings.provider !== "meta") {
    return {
      ok: false as const,
      error: "WhatsApp inbox replies require Meta Cloud API provider",
    };
  }

  const upload = await uploadMetaMedia({
    settings,
    buffer: params.file.buffer,
    mimeType,
    filename: params.file.filename,
  });

  if (!upload.ok) {
    return { ok: false as const, error: upload.error };
  }

  const caption = params.caption?.trim() || undefined;

  const result = await sendMetaImageMessage({
    settings,
    to: conversation.customerMobile,
    mediaId: upload.mediaId,
    caption,
  });

  if (!result.success || !result.externalId) {
    return {
      ok: false as const,
      error: result.error ?? result.debug?.staffError ?? "Failed to send image",
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

  const preview = caption ? `📷 ${caption.slice(0, 100)}` : "📷 Photo";
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
        messageType: "image",
        body: caption ?? null,
        mediaId: upload.mediaId,
        status: "sent",
        sentByStaffUserId: params.staffUserId,
        jobCardId,
      },
      select: {
        id: true,
        direction: true,
        messageType: true,
        body: true,
        mediaId: true,
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
