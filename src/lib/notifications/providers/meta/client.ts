import type {
  MetaTemplatePayload,
  NotificationSettingsDto,
  WhatsAppSendResult,
} from "../../types";
import { META_PUBLIC_ERROR_MESSAGE } from "./constants";
import {
  formatMetaErrorForStaff,
  parseMetaApiError,
  serializeMetaErrorForLog,
} from "./error-parser";
import {
  postMetaCloudApi,
  serializeRequestForLog,
} from "./http-client";
import { formatMetaRecipientE164 } from "./phone";
import {
  buildMetaMessagesEndpoint,
  buildMetaTemplateRequestBody,
} from "./payload-builder";
import {
  parseMetaSuccessResponse,
  serializeMetaSuccessForLog,
} from "./response-parser";

export type MetaSendParams = {
  settings: NotificationSettingsDto;
  /** 10-digit or E.164-ish mobile — normalized inside */
  to: string;
  metaTemplate: MetaTemplatePayload;
  /** Meta test environment may use verified international test numbers */
  allowInternationalRecipient?: boolean;
  /** Override template language — used by Test Connection (hello_world) */
  languageCode?: string;
  /** Enable verbose diagnostics for Test Connection only */
  diagnosticContext?: "test-connection";
};

function buildDebugLogBase(params: {
  templateName: string;
  recipientE164: string;
  requestUrl: string;
  requestBody: Record<string, unknown>;
}) {
  return {
    templateName: params.templateName,
    recipient: params.recipientE164,
    requestPayload: serializeRequestForLog(params.requestUrl, params.requestBody),
  };
}

export async function sendMetaTemplateMessage(
  params: MetaSendParams
): Promise<WhatsAppSendResult> {
  const phoneNumberId = params.settings.phoneNumberId?.trim();
  const accessToken = params.settings.accessToken?.trim();

  if (!phoneNumberId || !accessToken) {
    return {
      success: false,
      error: "Meta Cloud API requires Phone Number ID and Access Token",
    };
  }

  const phone = formatMetaRecipientE164(params.to, {
    allowInternational: params.allowInternationalRecipient,
  });
  if (!phone.ok) {
    return {
      success: false,
      error: phone.error,
      debug: {
        templateName: params.metaTemplate.templateName,
        recipient: params.to,
        metaErrorMessage: phone.error,
      },
    };
  }

  const requestUrl = buildMetaMessagesEndpoint(phoneNumberId, params.settings);
  const requestBody = buildMetaTemplateRequestBody(
    phone.e164,
    params.metaTemplate,
    params.languageCode
  );

  const isTestDiagnostic = params.diagnosticContext === "test-connection";

  if (isTestDiagnostic) {
    console.log("[TestConnection] sendMetaTemplateMessage → Meta request", {
      selectedProvider: "Meta Cloud API",
      phoneNumberId,
      whatsappBusinessAccountId: params.settings.whatsappBusinessAccountId,
      recipientE164: phone.e164,
      templateName: params.metaTemplate.templateName,
      languageCode: params.languageCode ?? "en (default)",
      requestUrl,
      requestPayload: requestBody,
    });
  }

  const debugBase = buildDebugLogBase({
    templateName: params.metaTemplate.templateName,
    recipientE164: phone.e164,
    requestUrl,
    requestBody,
  });

  const http = await postMetaCloudApi({
    url: requestUrl,
    accessToken,
    body: requestBody,
    diagnosticContext: params.diagnosticContext,
  });

  if (isTestDiagnostic) {
    console.log("[TestConnection] sendMetaTemplateMessage ← Meta response", {
      httpStatus: http.httpStatus,
      responseBody: http.bodyText,
      executionTimeMs: http.executionTimeMs,
    });
  }

  if (http.httpStatus < 200 || http.httpStatus >= 300) {
    const parsed = parseMetaApiError(http.httpStatus, http.bodyText);
    if (isTestDiagnostic) {
      console.log("[TestConnection] Meta error response", {
        httpStatus: parsed.httpStatus,
        metaErrorCode: parsed.metaErrorCode,
        metaErrorSubcode: parsed.metaErrorSubcode,
        metaErrorMessage: parsed.metaErrorMessage,
        metaErrorDetails: parsed.metaErrorDetails,
        fbtraceId: parsed.fbtraceId,
        rawResponse: parsed.rawResponse,
      });
    }
    return {
      success: false,
      error: META_PUBLIC_ERROR_MESSAGE,
      debug: {
        ...debugBase,
        httpStatus: parsed.httpStatus,
        metaErrorCode: parsed.metaErrorCode,
        metaErrorSubcode: parsed.metaErrorSubcode,
        metaErrorMessage: parsed.metaErrorMessage,
        metaErrorDetails: parsed.metaErrorDetails,
        responsePayload: parsed.rawResponse,
        executionTimeMs: http.executionTimeMs,
        staffError: formatMetaErrorForStaff(parsed),
        logError: serializeMetaErrorForLog(parsed),
      },
    };
  }

  const success = parseMetaSuccessResponse(http.bodyText);
  if (!success) {
    if (isTestDiagnostic) {
      console.log("[TestConnection] Meta success parse failed — no messages[0].id in body", {
        httpStatus: http.httpStatus,
        responseBody: http.bodyText,
      });
    }
    const parsed = parseMetaApiError(http.httpStatus, http.bodyText);
    return {
      success: false,
      error: META_PUBLIC_ERROR_MESSAGE,
      debug: {
        ...debugBase,
        httpStatus: http.httpStatus,
        metaErrorMessage: parsed.metaErrorMessage ?? "Missing message ID in Meta response",
        responsePayload: http.bodyText,
        executionTimeMs: http.executionTimeMs,
        staffError: "Meta API returned an unexpected response",
        logError: serializeMetaErrorForLog(parsed),
      },
    };
  }

  if (isTestDiagnostic) {
    console.log("[TestConnection] Meta accepted message — wamid from Meta API response", {
      wamid: success.messageId,
      contactWaId: success.contactWaId,
      rawResponse: success.rawResponse,
      note: "externalId is parsed from response.messages[0].id — not generated locally",
    });
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
