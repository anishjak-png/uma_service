import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  getNotificationSettings,
  updateNotificationSettings,
} from "@/lib/notifications/settings-store";

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const settings = await getNotificationSettings();
  return NextResponse.json(settings);
}

export async function PATCH(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await request.json();

  const allowedProviders = new Set(["meta", "interakt", "twilio", "custom"]);
  if (body.provider != null && !allowedProviders.has(body.provider)) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  if (
    body.additionalHeaders != null &&
    body.additionalHeaders !== "" &&
    typeof body.additionalHeaders === "string"
  ) {
    try {
      JSON.parse(body.additionalHeaders);
    } catch {
      return NextResponse.json(
        { error: "Additional Headers must be valid JSON" },
        { status: 400 }
      );
    }
  }

  const settings = await updateNotificationSettings({
    masterEnabled:
      typeof body.masterEnabled === "boolean" ? body.masterEnabled : undefined,
    jobCreatedEnabled:
      typeof body.jobCreatedEnabled === "boolean"
        ? body.jobCreatedEnabled
        : undefined,
    jobReadyEnabled:
      typeof body.jobReadyEnabled === "boolean" ? body.jobReadyEnabled : undefined,
    jobReturnEnabled:
      typeof body.jobReturnEnabled === "boolean" ? body.jobReturnEnabled : undefined,
    trackingLinkEnabled:
      typeof body.trackingLinkEnabled === "boolean"
        ? body.trackingLinkEnabled
        : undefined,
    provider: body.provider,
    apiUrl: body.apiUrl === "" ? null : body.apiUrl,
    apiKey: body.apiKey === "" ? null : body.apiKey,
    accessToken: body.accessToken === "" ? null : body.accessToken,
    phoneNumberId: body.phoneNumberId === "" ? null : body.phoneNumberId,
    whatsappBusinessAccountId:
      body.whatsappBusinessAccountId === ""
        ? null
        : body.whatsappBusinessAccountId,
    businessNumber: body.businessNumber === "" ? null : body.businessNumber,
    additionalHeaders:
      body.additionalHeaders === "" ? null : body.additionalHeaders,
  });

  return NextResponse.json(settings);
}
