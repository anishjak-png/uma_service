import { SHOP_NAME, SHOP_PHONE } from "./constants";
import { formatMobileDisplay, normalizeMobile } from "./jobs";

export function buildReadyMessage(params: {
  customerName?: string | null;
  applianceType: string;
  brand?: string | null;
  jobNumber: string;
  finalCost?: number | null;
}): string {
  const appliance = [params.brand, params.applianceType].filter(Boolean).join(" ");
  const costLine =
    params.finalCost != null ? `Repair cost: Rs ${params.finalCost}` : "";

  return [
    `${SHOP_NAME}`,
    "",
    `Your ${appliance} (Job ${params.jobNumber}) is ready for pickup.`,
    costLine,
    "",
    "Please visit our shop to collect.",
    SHOP_PHONE ? `Call: ${formatMobileDisplay(SHOP_PHONE)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildWhatsAppUrl(mobile: string, message: string): string {
  const digits = normalizeMobile(mobile);
  const phone = digits.startsWith("91") ? digits : `91${digits}`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
