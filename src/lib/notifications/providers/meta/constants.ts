/** Default Graph API version — override via META_GRAPH_API_VERSION env. */
export const DEFAULT_META_GRAPH_API_VERSION = "v23.0";

/** Verified Meta test recipient — optional default for connection tests. */
export function getMetaTestRecipientPhone(): string | undefined {
  const fromEnv = process.env.META_TEST_RECIPIENT_PHONE?.trim();
  return fromEnv || undefined;
}

/** User-safe message when Meta delivery fails (no raw API details). */
export const META_PUBLIC_ERROR_MESSAGE =
  "WhatsApp message could not be delivered. Please contact support if this continues.";

/** Approved UMA template locale — override via META_TEMPLATE_LANGUAGE_CODE env. */
export function getMetaTemplateLanguageCode(): string {
  const fromEnv = process.env.META_TEMPLATE_LANGUAGE_CODE?.trim();
  return fromEnv || "en";
}
