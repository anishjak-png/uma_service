import { NextResponse } from "next/server";
import { requireWhatsAppInboxAccess } from "@/lib/auth";
import { listWhatsAppConversations } from "@/lib/whatsapp-inbox";

export async function GET() {
  const session = await requireWhatsAppInboxAccess();
  if (!session) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const data = await listWhatsAppConversations();
  return NextResponse.json(data);
}
