import { buildEscPosReceipt, buildReceiptData } from "../../src/lib/thermal";
import { parseAccessories } from "../../src/lib/jobs";
import type { BridgeConfig } from "./config";
import type { JobCardRow } from "./types";

/** Build ESC/POS buffer using shared receipt layout (constants overridden via env). */
export function buildReceiptBuffer(jobCard: JobCardRow, config: BridgeConfig): Buffer {
  process.env.NEXT_PUBLIC_APP_URL = config.appUrl;
  process.env.NEXT_PUBLIC_SHOP_NAME = config.shopName;
  process.env.NEXT_PUBLIC_SHOP_PHONE = config.shopPhone;

  const customer = jobCard.Customer;
  if (!customer) {
    throw new Error("Customer not found for job card");
  }

  const receiptData = buildReceiptData({
    jobNumber: jobCard.jobNumber,
    receivedAt: new Date(jobCard.receivedAt),
    customer: { mobile: customer.mobile, name: customer.name },
    applianceType: jobCard.applianceType,
    brand: jobCard.brand,
    model: jobCard.model,
    complaint: jobCard.complaint,
    accessories: parseAccessories(jobCard.accessories).length
      ? jobCard.accessories
      : null,
  });

  return buildEscPosReceipt(receiptData);
}
