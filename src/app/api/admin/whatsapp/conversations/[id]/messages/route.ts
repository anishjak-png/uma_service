import { NextRequest, NextResponse } from "next/server";
import { requireWhatsAppInboxAccess } from "@/lib/auth";
import {
  getWhatsAppMessages,
  sendWhatsAppReply,
} from "@/lib/whatsapp-inbox";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const session = await requireWhatsAppInboxAccess();
  if (!session) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { id } = await context.params;
  const page = Math.max(
    1,
    Number.parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10) || 1
  );

  const data = await getWhatsAppMessages(id, page);
  if (!data) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await requireWhatsAppInboxAccess();
  if (!session) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  if (!session.staffUserId) {
    return NextResponse.json({ error: "Staff session invalid" }, { status: 403 });
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { body?: string } | null;
  const text = body?.body?.trim() ?? "";

  const result = await sendWhatsAppReply({
    conversationId: id,
    body: text,
    staffUserId: session.staffUserId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ message: result.message });
}
