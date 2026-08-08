import { NextResponse } from "next/server";
import { requireWhatsAppInboxAccess } from "@/lib/auth";
import { markWhatsAppConversationRead } from "@/lib/whatsapp-inbox";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(_request: Request, context: RouteContext) {
  const session = await requireWhatsAppInboxAccess();
  if (!session) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { id } = await context.params;
  const updated = await markWhatsAppConversationRead(id);

  if (!updated) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
