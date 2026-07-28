import type { WhatsAppProviderAdapter } from "../whatsapp-providers";
import { sendMetaTemplateMessage } from "./client";

export { testMetaCloudConnection } from "./test-connection";
export { formatMetaRecipientE164 } from "./phone";
export { buildMetaMessagesEndpoint, resolveMetaGraphApiVersion } from "./payload-builder";

export const sendViaMeta: WhatsAppProviderAdapter = async ({
  to,
  settings,
  metaTemplate,
}) => {
  if (!metaTemplate) {
    return {
      success: false,
      error: "Meta Cloud API requires an approved template payload",
    };
  }

  return sendMetaTemplateMessage({
    settings,
    to,
    metaTemplate,
  });
};
