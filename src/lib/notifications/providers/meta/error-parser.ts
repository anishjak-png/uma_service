export type ParsedMetaApiError = {
  httpStatus: number;
  metaErrorCode?: number;
  metaErrorSubcode?: number;
  metaErrorType?: string;
  metaErrorMessage?: string;
  metaErrorDetails?: string;
  fbtraceId?: string;
  rawResponse: string;
};

type MetaErrorBody = {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    error_data?: { details?: string };
    fbtrace_id?: string;
  };
  message?: string;
};

export function parseMetaApiError(
  httpStatus: number,
  responseText: string
): ParsedMetaApiError {
  let body: MetaErrorBody = {};

  try {
    body = responseText ? JSON.parse(responseText) : {};
  } catch {
    return {
      httpStatus,
      metaErrorMessage: responseText || "Unknown Meta API error",
      rawResponse: responseText,
    };
  }

  const err = body.error;

  return {
    httpStatus,
    metaErrorCode: err?.code,
    metaErrorSubcode: err?.error_subcode,
    metaErrorType: err?.type,
    metaErrorMessage: err?.message ?? body.message ?? responseText,
    metaErrorDetails: err?.error_data?.details,
    fbtraceId: err?.fbtrace_id,
    rawResponse: responseText,
  };
}

/** Staff-safe summary — never includes tokens or full raw payloads. */
export function formatMetaErrorForStaff(parsed: ParsedMetaApiError): string {
  const code = parsed.metaErrorCode;
  const message = parsed.metaErrorMessage ?? "Unknown error";
  if (code != null) {
    return `Meta API error (${code}): ${message}`;
  }
  return `Meta API error: ${message}`;
}

export function serializeMetaErrorForLog(parsed: ParsedMetaApiError): string {
  return JSON.stringify({
    httpStatus: parsed.httpStatus,
    metaErrorCode: parsed.metaErrorCode,
    metaErrorSubcode: parsed.metaErrorSubcode,
    metaErrorType: parsed.metaErrorType,
    metaErrorMessage: parsed.metaErrorMessage,
    metaErrorDetails: parsed.metaErrorDetails,
    fbtraceId: parsed.fbtraceId,
    response: parsed.rawResponse,
  });
}
