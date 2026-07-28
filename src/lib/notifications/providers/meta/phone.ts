export type MetaPhoneFormatResult =
  | { ok: true; e164: string }
  | { ok: false; error: string };

type FormatMetaRecipientOptions = {
  /** Allow any E.164-style number (for Meta test recipients). Default: Indian mobiles only. */
  allowInternational?: boolean;
};

/**
 * Convert a mobile number to Meta WhatsApp `to` format (E.164 without '+').
 * Example: 9842241388 → 919842241388
 */
export function formatMetaRecipientE164(
  mobile: string,
  options?: FormatMetaRecipientOptions
): MetaPhoneFormatResult {
  const digits = mobile.replace(/[\s+\-()]/g, "");

  if (!digits) {
    return { ok: false, error: "Mobile number is empty" };
  }

  if (options?.allowInternational && /^\d{10,15}$/.test(digits)) {
    return { ok: true, e164: digits };
  }

  if (digits.length === 12 && digits.startsWith("91")) {
    const local = digits.slice(2);
    if (/^[6-9]\d{9}$/.test(local)) {
      return { ok: true, e164: digits };
    }
    return {
      ok: false,
      error: "Invalid Indian mobile number after country code 91",
    };
  }

  if (digits.length === 10 && /^[6-9]\d{9}$/.test(digits)) {
    return { ok: true, e164: `91${digits}` };
  }

  return {
    ok: false,
    error: options?.allowInternational
      ? "Invalid phone number for WhatsApp (expected 10–15 digits with country code)"
      : `Invalid mobile number for WhatsApp (expected 10-digit Indian number, got ${digits.length} digits)`,
  };
}
