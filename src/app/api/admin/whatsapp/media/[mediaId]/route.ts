import { NextResponse } from "next/server";
import { requireWhatsAppInboxAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  downloadMetaMedia,
  fetchMetaMediaMetadata,
} from "@/lib/notifications/providers/meta/fetch-media";
import { getNotificationSettings } from "@/lib/notifications/settings-store";

type RouteContext = { params: Promise<{ mediaId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await requireWhatsAppInboxAccess();
  if (!session) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { mediaId } = await context.params;
  if (!mediaId?.trim()) {
    return NextResponse.json({ error: "Media ID required" }, { status: 400 });
  }

  const known = await prisma.whatsAppMessage.findFirst({
    where: { mediaId },
    select: { id: true },
  });
  if (!known) {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }

  const settings = await getNotificationSettings();
  if (settings.provider !== "meta") {
    return NextResponse.json(
      { error: "Meta Cloud API not configured" },
      { status: 400 }
    );
  }

  const accessToken = settings.accessToken?.trim();
  if (!accessToken) {
    return NextResponse.json({ error: "Access token not configured" }, { status: 400 });
  }

  const meta = await fetchMetaMediaMetadata(mediaId, accessToken, settings);
  if (!meta.ok) {
    return NextResponse.json({ error: meta.error }, { status: 502 });
  }

  const file = await downloadMetaMedia(meta.url, accessToken);
  if (!file.ok) {
    return NextResponse.json({ error: file.error }, { status: 502 });
  }

  return new NextResponse(new Uint8Array(file.buffer), {
    headers: {
      "Content-Type": file.mimeType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
