import { NextRequest, NextResponse } from "next/server";
import { requireWhatsAppInboxAccess } from "@/lib/auth";
import {
  getWhatsAppMessages,
  sendWhatsAppImageReply,
  sendWhatsAppReply,
} from "@/lib/whatsapp-inbox";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
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
  } catch (err) {
    console.error("[WhatsApp] GET messages failed:", err);
    const message =
      err instanceof Error ? err.message : "Failed to load messages";
    return NextResponse.json({ error: message }, { status: 500 });
  }
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
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Image file is required" }, { status: 400 });
    }

    const caption = form.get("caption");
    const buffer = Buffer.from(await file.arrayBuffer());

    const result = await sendWhatsAppImageReply({
      conversationId: id,
      file: {
        buffer,
        mimeType: file.type || "image/jpeg",
        filename: file.name || "image.jpg",
      },
      caption: typeof caption === "string" ? caption : undefined,
      staffUserId: session.staffUserId,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ message: result.message });
  }

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
