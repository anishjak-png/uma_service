import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getNotificationSettings } from "@/lib/notifications/settings-store";
import { testMetaCloudConnection } from "@/lib/notifications/providers/meta";

export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const settings = await getNotificationSettings();
  if (settings.provider !== "meta") {
    return NextResponse.json(
      { error: "Test connection is only available for Meta Cloud API" },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const recipientPhone =
    typeof body.recipientPhone === "string" ? body.recipientPhone : undefined;

  console.log("[TestConnection] API route invoked", {
    provider: settings.provider,
    phoneNumberId: settings.phoneNumberId,
    whatsappBusinessAccountId: settings.whatsappBusinessAccountId,
    recipientPhone: recipientPhone ?? "(from META_TEST_RECIPIENT_PHONE env)",
  });

  const result = await testMetaCloudConnection({
    settings,
    testPhone: recipientPhone,
  });

  console.log("[TestConnection] API route result", {
    success: result.success,
    externalId: result.externalId,
    error: result.error,
    httpStatus: result.debug?.httpStatus,
    metaErrorCode: result.debug?.metaErrorCode,
    metaErrorMessage: result.debug?.metaErrorMessage,
    responsePayload: result.debug?.responsePayload,
  });

  if (!result.success) {
    return NextResponse.json(
      {
        success: false,
        error: result.error,
        debug: result.debug,
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    externalId: result.externalId,
    debug: result.debug,
  });
}
