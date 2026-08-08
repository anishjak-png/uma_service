import { prisma } from "@/lib/db";
import { formatMobileDisplay } from "@/lib/jobs";
import { getNotificationSettings } from "@/lib/notifications/settings-store";
import { sendMetaTextMessage } from "@/lib/notifications/providers/meta/send-text-message";
import { ACTIVE_JOB_STATUSES } from "@/lib/prisma-statuses";

const MESSAGE_PAGE_SIZE = 50;

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

  const [messages, total] = await Promise.all([
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
          select: { id: true, jobNumber: true },
        },
      },
    }),
    prisma.whatsAppMessage.count({ where: { conversationId } }),
  ]);

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
    messages: messages.map((m) => ({
      ...m,
      createdAt: m.createdAt.toISOString(),
    })),
    page,
    totalPages: Math.max(1, Math.ceil(total / MESSAGE_PAGE_SIZE)),
    total,
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
