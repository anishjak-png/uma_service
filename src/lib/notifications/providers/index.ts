import type { WhatsAppProviderType } from "@prisma/client";
import type { WhatsAppProviderAdapter } from "./whatsapp-providers";
import {
  sendViaCustom,
  sendViaInterakt,
  sendViaMeta,
  sendViaTwilio,
} from "./whatsapp-providers";

const adapters: Record<WhatsAppProviderType, WhatsAppProviderAdapter> = {
  meta: sendViaMeta,
  interakt: sendViaInterakt,
  twilio: sendViaTwilio,
  custom: sendViaCustom,
};

export function getWhatsAppProvider(
  provider: WhatsAppProviderType
): WhatsAppProviderAdapter {
  return adapters[provider];
}
