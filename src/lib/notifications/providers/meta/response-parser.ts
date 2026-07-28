export type ParsedMetaSuccess = {
  messageId: string;
  contactWaId?: string;
  rawResponse: string;
};

type MetaSuccessBody = {
  messaging_product?: string;
  contacts?: Array<{ input?: string; wa_id?: string }>;
  messages?: Array<{ id?: string }>;
};

export function parseMetaSuccessResponse(responseText: string): ParsedMetaSuccess | null {
  let body: MetaSuccessBody = {};

  try {
    body = responseText ? JSON.parse(responseText) : {};
  } catch {
    return null;
  }

  const messageId = body.messages?.[0]?.id;
  if (!messageId) {
    return null;
  }

  return {
    messageId,
    contactWaId: body.contacts?.[0]?.wa_id,
    rawResponse: responseText,
  };
}

export function serializeMetaSuccessForLog(
  parsed: ParsedMetaSuccess,
  executionTimeMs: number
): string {
  return JSON.stringify({
    messageId: parsed.messageId,
    contactWaId: parsed.contactWaId,
    sentAt: new Date().toISOString(),
    executionTimeMs,
    response: parsed.rawResponse,
  });
}
