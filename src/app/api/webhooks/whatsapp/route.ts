import { NextRequest, NextResponse } from "next/server";
import {
  getWebhookVerifyToken,
  processMetaWhatsAppWebhook,
  verifyWebhookSignature,
} from "@/lib/notifications/inbound/meta-webhook";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = getWebhookVerifyToken();
  if (!verifyToken) {
    console.error("[WhatsApp Webhook] WHATSAPP_WEBHOOK_VERIFY_TOKEN not configured");
    return new NextResponse("Verify token not configured", { status: 500 });
  }

  if (mode === "subscribe" && token === verifyToken && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!verifyWebhookSignature(rawBody, signature)) {
    console.error("[WhatsApp Webhook] Invalid signature");
    return new NextResponse("Invalid signature", { status: 403 });
  }

  try {
    await processMetaWhatsAppWebhook(rawBody);
  } catch (err) {
    console.error("[WhatsApp Webhook] Processing error", err);
  }

  return new NextResponse("OK", { status: 200 });
}
