import {
  buildEscPosSaleReceipt,
  isSaleReceiptData,
  type SaleReceiptData,
} from "../../src/modules/spare-parts/lib/thermal-sale";
import type { BridgeConfig } from "./config";

export function buildSaleReceiptBuffer(payload: unknown, config: BridgeConfig): Buffer {
  process.env.NEXT_PUBLIC_APP_URL = config.appUrl;
  process.env.NEXT_PUBLIC_SHOP_NAME = config.shopName;
  process.env.NEXT_PUBLIC_SHOP_PHONE = config.shopPhone;

  if (!isSaleReceiptData(payload)) {
    throw new Error("Sale receipt payload is missing");
  }

  const data: SaleReceiptData = payload;
  return Buffer.from(buildEscPosSaleReceipt(data));
}
