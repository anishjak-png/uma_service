import type { NotificationSettingsDto, WhatsAppSendResult } from "../../types";
import { META_PUBLIC_ERROR_MESSAGE } from "./constants";
import {
  formatMetaErrorForStaff,
  parseMetaApiError,
  serializeMetaErrorForLog,
} from "./error-parser";
import { postMetaCloudApi, serializeRequestForLog } from "./http-client";
import { formatMetaRecipientE164 } from "./phone";
import { buildMetaMessagesEndpoint } from "./payload-builder";
import {
  parseMetaSuccessResponse,
  serializeMetaSuccessForLog,
} from "./response-parser";

export type MetaTextSendParams = {
  settings: NotificationSettingsDto;
  to: string;
  body: string;
};

export async function sendMetaTextMessage(
  params: MetaTextSendParams
): Promise<WhatsAppSendResult> {
  const phoneNumberId = params.settings.phoneNumberId?.trim();
  const accessToken = params.settings.accessToken?.trim();

  if (!phoneNumberId || !accessToken) {
    return {
      success: false,
      error: "Meta Cloud API requires Phone Number ID and Access Token",
    };
  }

  const text = params.body.trim();
  if (!text) {
    return { success: false, error: "Message body is empty" };
  }

  const phone = formatMetaRecipientE164(params.to);
  if (!phone.ok) {
    return { success: false, error: phone.error };
  }

  const requestUrl = buildMetaMessagesEndpoint(phoneNumberId, params.settings);
  const requestBody = {
    messaging_product: "whatsapp",
    to: phone.e164,
    type: "text",
    text: { body: text },
  };

  const http = await postMetaCloudApi({
    url: requestUrl,
    accessToken,
    body: requestBody,
  });

  const debugBase = {
    templateName: "session_text",
    recipient: phone.e164,
    requestPayload: serializeRequestForLog(requestUrl, requestBody),
  };

  if (http.httpStatus < 200 || http.httpStatus >= 300) {
    const parsed = parseMetaApiError(http.httpStatus, http.bodyText);
    return {
      success: false,
      error: META_PUBLIC_ERROR_MESSAGE,
      debug: {
        ...debugBase,
        httpStatus: parsed.httpStatus,
        metaErrorMessage: parsed.metaErrorMessage,
        responsePayload: parsed.rawResponse,
        executionTimeMs: http.executionTimeMs,
        staffError: formatMetaErrorForStaff(parsed),
        logError: serializeMetaErrorForLog(parsed),
      },
    };
  }

  const success = parseMetaSuccessResponse(http.bodyText);
  if (!success) {
    const parsed = parseMetaApiError(http.httpStatus, http.bodyText);
    return {
      success: false,
      error: META_PUBLIC_ERROR_MESSAGE,
      debug: {
        ...debugBase,
        httpStatus: http.httpStatus,
        metaErrorMessage:
          parsed.metaErrorMessage ?? "Missing message ID in Meta response",
        responsePayload: http.bodyText,
        executionTimeMs: http.executionTimeMs,
        staffError: "Meta API returned an unexpected response",
        logError: serializeMetaErrorForLog(parsed),
      },
    };
  }

  return {
    success: true,
    externalId: success.messageId,
    debug: {
      ...debugBase,
      httpStatus: http.httpStatus,
      responsePayload: serializeMetaSuccessForLog(success, http.executionTimeMs),
      executionTimeMs: http.executionTimeMs,
      sentAt: new Date().toISOString(),
    },
  };
}
