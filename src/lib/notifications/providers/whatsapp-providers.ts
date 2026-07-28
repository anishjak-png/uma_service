import type { WhatsAppSendParams, WhatsAppSendResult } from "../types";

export type WhatsAppProviderAdapter = (
  params: WhatsAppSendParams
) => Promise<WhatsAppSendResult>;

async function parseProviderResponse(
  res: Response
): Promise<{ externalId?: string; error?: string }> {
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    if (!res.ok) {
      return { error: text || res.statusText };
    }
  }

  if (!res.ok) {
    const err =
      (data.error as { message?: string })?.message ??
      (data.message as string) ??
      text ??
      res.statusText;
    return { error: String(err) };
  }

  const externalId =
    (data.messages as Array<{ id?: string }>)?.[0]?.id ??
    (data.id as string | undefined) ??
    (data.messageId as string | undefined);

  return { externalId };
}

export { sendViaMeta } from "./meta";

export const sendViaInterakt: WhatsAppProviderAdapter = async ({
  to,
  message,
  settings,
}) => {
  const apiKey = settings.apiKey?.trim();
  if (!apiKey) {
    return { success: false, error: "Interakt requires an API Key" };
  }

  const url =
    settings.apiUrl?.trim() ||
    "https://api.interakt.ai/v1/public/message/";

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      countryCode: "+91",
      phoneNumber: to,
      type: "Text",
      data: { message },
    }),
  });

  const parsed = await parseProviderResponse(res);
  if (parsed.error) {
    return { success: false, error: parsed.error };
  }
  return { success: true, externalId: parsed.externalId };
};

export const sendViaTwilio: WhatsAppProviderAdapter = async ({
  to,
  message,
  settings,
}) => {
  const accountSid = settings.apiKey?.trim();
  const authToken = settings.accessToken?.trim();
  const from = settings.businessNumber?.trim();

  if (!accountSid || !authToken || !from) {
    return {
      success: false,
      error: "Twilio requires API Key (Account SID), Access Token, and Business Number",
    };
  }

  const url =
    settings.apiUrl?.trim() ||
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

  const body = new URLSearchParams({
    To: `whatsapp:+91${to}`,
    From: from.startsWith("whatsapp:") ? from : `whatsapp:${from}`,
    Body: message,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const parsed = await parseProviderResponse(res);
  if (parsed.error) {
    return { success: false, error: parsed.error };
  }
  return { success: true, externalId: parsed.externalId };
};

export const sendViaCustom: WhatsAppProviderAdapter = async ({
  to,
  message,
  settings,
}) => {
  const url = settings.apiUrl?.trim();
  if (!url) {
    return { success: false, error: "Custom API requires an API URL" };
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (settings.apiKey?.trim()) {
    headers.Authorization = `Bearer ${settings.apiKey.trim()}`;
  }
  if (settings.accessToken?.trim()) {
    headers["X-Access-Token"] = settings.accessToken.trim();
  }

  if (settings.additionalHeaders?.trim()) {
    try {
      const extra = JSON.parse(settings.additionalHeaders) as Record<string, string>;
      Object.assign(headers, extra);
    } catch {
      return { success: false, error: "Invalid Additional Headers JSON" };
    }
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      to: `91${to}`,
      phone: to,
      mobile: to,
      message,
      body: message,
      phoneNumberId: settings.phoneNumberId,
      businessNumber: settings.businessNumber,
    }),
  });

  const parsed = await parseProviderResponse(res);
  if (parsed.error) {
    return { success: false, error: parsed.error };
  }
  return { success: true, externalId: parsed.externalId };
};
