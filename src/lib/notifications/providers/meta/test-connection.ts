import type { NotificationSettingsDto, WhatsAppSendResult } from "../../types";
import { getMetaTestRecipientPhone } from "./constants";
import { sendMetaTemplateMessage } from "./client";
import { formatMetaRecipientE164 } from "./phone";

/** Meta built-in template used permanently for admin Test Connection. */
const META_TEST_CONNECTION_TEMPLATE = {
  templateName: "hello_world",
  variables: [] as string[],
  languageCode: "en_US",
} as const;

/**
 * Sends Meta's built-in `hello_world` template to verify Cloud API credentials.
 * Sender is the configured Phone Number ID — not WhatsApp Phone Number.
 * Recipient: `testPhone` param, else `META_TEST_RECIPIENT_PHONE` env.
 */
export async function testMetaCloudConnection(params: {
  settings: NotificationSettingsDto;
  testPhone?: string;
}): Promise<WhatsAppSendResult> {
  const rawPhone =
    params.testPhone?.trim() || getMetaTestRecipientPhone() || "";

  if (!rawPhone) {
    return {
      success: false,
      error:
        "Enter a recipient phone number for the test message, or set META_TEST_RECIPIENT_PHONE in the environment.",
    };
  }

  const phone = formatMetaRecipientE164(rawPhone, { allowInternational: true });
  if (!phone.ok) {
    return { success: false, error: phone.error };
  }

  console.log("[TestConnection] Preparing send", {
    selectedProvider: "Meta Cloud API",
    phoneNumberId: params.settings.phoneNumberId,
    whatsappBusinessAccountId: params.settings.whatsappBusinessAccountId,
    recipientRaw: rawPhone,
    recipientE164: phone.e164,
    templateName: META_TEST_CONNECTION_TEMPLATE.templateName,
    languageCode: META_TEST_CONNECTION_TEMPLATE.languageCode,
    variables: META_TEST_CONNECTION_TEMPLATE.variables,
  });

  const result = await sendMetaTemplateMessage({
    settings: params.settings,
    to: rawPhone,
    allowInternationalRecipient: true,
    languageCode: META_TEST_CONNECTION_TEMPLATE.languageCode,
    diagnosticContext: "test-connection",
    metaTemplate: {
      templateName: META_TEST_CONNECTION_TEMPLATE.templateName,
      variables: [...META_TEST_CONNECTION_TEMPLATE.variables],
    },
  });

  if (!result.success && result.debug) {
    return {
      ...result,
      error:
        result.debug.staffError ??
        result.debug.metaErrorMessage ??
        result.error,
    };
  }

  return result;
}
