import type { MetaTemplatePayload, MetaTemplateVariableFormat } from "../../types";
import type { NotificationSettingsDto } from "../../types";
import { DEFAULT_META_GRAPH_API_VERSION, getMetaTemplateLanguageCode } from "./constants";

function buildBodyParameter(
  text: string,
  format: MetaTemplateVariableFormat = "text"
): Record<string, unknown> {
  if (format === "currency") {
    const amount = Number(text.replace(/,/g, "")) || 0;
    return {
      type: "currency",
      currency: {
        fallback_value: `Rs. ${text}`,
        code: "INR",
        amount_1000: Math.round(amount * 1000),
      },
    };
  }

  return { type: "text", text };
}

export function resolveMetaTemplateLanguageCode(
  explicitLanguageCode?: string
): string {
  return explicitLanguageCode ?? getMetaTemplateLanguageCode();
}

export function resolveMetaGraphApiVersion(
  settings: NotificationSettingsDto
): string {
  const fromEnv = process.env.META_GRAPH_API_VERSION?.trim();
  if (fromEnv) {
    return fromEnv.startsWith("v") ? fromEnv : `v${fromEnv}`;
  }

  const apiUrl = settings.apiUrl?.trim();
  if (apiUrl) {
    const versionMatch = apiUrl.match(/graph\.facebook\.com\/(v\d+(?:\.\d+)?)/i);
    if (versionMatch) {
      return versionMatch[1];
    }
  }

  return DEFAULT_META_GRAPH_API_VERSION;
}

export function buildMetaMessagesEndpoint(
  phoneNumberId: string,
  settings: NotificationSettingsDto
): string {
  const customUrl = settings.apiUrl?.trim();

  if (customUrl && /\/messages\/?$/i.test(customUrl)) {
    return customUrl.replace(/\/$/, "");
  }

  const version = resolveMetaGraphApiVersion(settings);
  return `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;
}

export function buildMetaTemplateRequestBody(
  recipientE164: string,
  metaTemplate: MetaTemplatePayload,
  languageCode?: string
): Record<string, unknown> {
  const template: Record<string, unknown> = {
    name: metaTemplate.templateName,
    language: { code: resolveMetaTemplateLanguageCode(languageCode) },
  };

  const components: Record<string, unknown>[] = [];

  if (metaTemplate.variables.length > 0) {
    components.push({
      type: "body",
      parameters: metaTemplate.variables.map((text, index) =>
        buildBodyParameter(
          text,
          metaTemplate.variableFormats?.[index] ?? "text"
        )
      ),
    });
  }

  if (metaTemplate.urlButtonParameter != null) {
    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [
        {
          type: "text",
          text: metaTemplate.urlButtonParameter,
        },
      ],
    });
  }

  if (components.length > 0) {
    template.components = components;
  }

  return {
    messaging_product: "whatsapp",
    to: recipientE164,
    type: "template",
    template,
  };
}
