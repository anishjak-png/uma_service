import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { ACTIVE_JOB_STATUSES } from "@/lib/prisma-statuses";
import { parseWaIdToMobile } from "@/lib/notifications/providers/meta/phone";

type MetaInboundMessage = {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body?: string };
  image?: { caption?: string };
};

type MetaWebhookBody = {
  object?: string;
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: MetaInboundMessage[];
        metadata?: { phone_number_id?: string };
      };
    }>;
  }>;
};

export function getWebhookVerifyToken(): string | null {
  return process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim() || null;
}

export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null
): boolean {
  const appSecret = process.env.META_APP_SECRET?.trim();
  if (!appSecret) {
    console.warn("[WhatsApp Webhook] META_APP_SECRET not set — skipping signature check");
    return true;
  }

  if (!signatureHeader?.startsWith("sha256=")) {
    return false;
  }

  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const received = signatureHeader.slice("sha256=".length);

  if (expected.length !== received.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

function extractMessageBody(msg: MetaInboundMessage): {
  messageType: "text" | "image" | "unsupported";
  body: string;
} {
  if (msg.type === "text" && msg.text?.body) {
    return { messageType: "text", body: msg.text.body };
  }
  if (msg.type === "image") {
    const caption = msg.image?.caption?.trim();
    return {
      messageType: "image",
      body: caption || "[Image received]",
    };
  }
  return {
    messageType: "unsupported",
    body: `[${msg.type} message]`,
  };
}

async function findLatestActiveJobId(customerId: string): Promise<string | null> {
  if (ACTIVE_JOB_STATUSES.length === 0) return null;

  const job = await prisma.jobCard.findFirst({
    where: {
      customerId,
      status: { in: ACTIVE_JOB_STATUSES },
    },
    orderBy: { receivedAt: "desc" },
    select: { id: true },
  });

  return job?.id ?? null;
}

async function persistInboundMessage(
  msg: MetaInboundMessage,
  rawPayload: string
): Promise<void> {
  const mobile = parseWaIdToMobile(msg.from);
  if (!mobile) {
    console.warn("[WhatsApp Webhook] Unrecognized wa_id", { from: msg.from });
    return;
  }

  const existing = await prisma.whatsAppMessage.findUnique({
    where: { wamid: msg.id },
    select: { id: true },
  });
  if (existing) return;

  const customer = await prisma.customer.findUnique({
    where: { mobile },
    select: { id: true },
  });

  const jobCardId = customer
    ? await findLatestActiveJobId(customer.id)
    : null;

  const { messageType, body } = extractMessageBody(msg);
  const preview = body.slice(0, 120);
  const messageAt = new Date(Number.parseInt(msg.timestamp, 10) * 1000);

  await prisma.$transaction(async (tx) => {
    const conversation = await tx.whatsAppConversation.upsert({
      where: { customerMobile: mobile },
      create: {
        customerMobile: mobile,
        customerId: customer?.id ?? null,
        lastMessageAt: messageAt,
        lastMessagePreview: preview,
        unreadCount: 1,
      },
      update: {
        customerId: customer?.id ?? undefined,
        lastMessageAt: messageAt,
        lastMessagePreview: preview,
        unreadCount: { increment: 1 },
      },
    });

    await tx.whatsAppMessage.create({
      data: {
        conversationId: conversation.id,
        direction: "inbound",
        wamid: msg.id,
        messageType,
        body,
        status: "received",
        jobCardId,
        rawPayload,
      },
    });
  });
}

export async function processMetaWhatsAppWebhook(
  rawBody: string
): Promise<void> {
  let payload: MetaWebhookBody;

  try {
    payload = JSON.parse(rawBody) as MetaWebhookBody;
  } catch {
    console.error("[WhatsApp Webhook] Invalid JSON body");
    return;
  }

  if (payload.object !== "whatsapp_business_account") {
    return;
  }

  const messages: MetaInboundMessage[] = [];

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const msg of change.value?.messages ?? []) {
        messages.push(msg);
      }
    }
  }

  for (const msg of messages) {
    try {
      await persistInboundMessage(msg, rawBody);
    } catch (err) {
      console.error("[WhatsApp Webhook] Failed to persist message", {
        wamid: msg.id,
        err,
      });
    }
  }
}
