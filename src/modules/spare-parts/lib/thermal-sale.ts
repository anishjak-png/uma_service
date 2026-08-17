const RECEIPT_WIDTH = 42;
const LABEL_WIDTH = 10;
const NAME_WIDTH = 24;
const QTY_WIDTH = 6;
const AMT_WIDTH = 12;

export type SaleReceiptItem = {
  name: string;
  code: string;
  qty: number;
  unit_price: number;
  line_total: number;
};

export type SaleReceiptData = {
  billNo: string;
  date: string;
  items: SaleReceiptItem[];
  total: number;
};

function shopName() {
  return process.env.NEXT_PUBLIC_SHOP_NAME?.trim() || "Uma Traders";
}

function shopPhone() {
  return process.env.NEXT_PUBLIC_SHOP_PHONE?.trim() || "";
}

function centerText(text: string, width = RECEIPT_WIDTH): string {
  const pad = Math.max(0, Math.floor((width - text.length) / 2));
  return " ".repeat(pad) + text;
}

function formatLabelLine(label: string, value: string): string {
  return `${label.padEnd(LABEL_WIDTH, " ")}: ${value}`;
}

function formatMobileDisplay(mobile: string): string {
  const digits = mobile.replace(/\D/g, "");
  if (digits.length !== 10) return mobile;
  return `${digits.slice(0, 5)} ${digits.slice(5)}`;
}

function formatAmount(value: number): string {
  return Math.round(Number(value) || 0).toLocaleString("en-IN");
}

function clip(text: string, width: number): string {
  if (text.length <= width) return text.padEnd(width, " ");
  return `${text.slice(0, Math.max(0, width - 3))}...`;
}

function itemHeader(): string {
  return `${"Item".padEnd(NAME_WIDTH, " ")}${"Qty".padStart(QTY_WIDTH, " ")}${"Amount".padStart(AMT_WIDTH, " ")}`;
}

function itemLine(item: SaleReceiptItem): string {
  return `${clip(item.name, NAME_WIDTH)}${String(item.qty).padStart(QTY_WIDTH, " ")}${formatAmount(item.line_total).padStart(AMT_WIDTH, " ")}`;
}

function totalLine(total: number): string {
  const label = "Total".padEnd(NAME_WIDTH + QTY_WIDTH, " ");
  return `${label}${formatAmount(total).padStart(AMT_WIDTH, " ")}`;
}

export function buildSaleReceiptData(sale: {
  bill_no: string;
  total: number;
  created_at: string;
  items: SaleReceiptItem[];
}): SaleReceiptData {
  return {
    billNo: sale.bill_no,
    date: new Date(sale.created_at).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    items: sale.items,
    total: sale.total,
  };
}

export function isSaleReceiptData(value: unknown): value is SaleReceiptData {
  if (!value || typeof value !== "object") return false;
  const data = value as SaleReceiptData;
  return typeof data.billNo === "string" && typeof data.date === "string" && Array.isArray(data.items);
}

/** Plain-text receipt for browser preview / thermal PDF (80mm layout) */
export function formatSaleReceiptText80mm(data: SaleReceiptData): string {
  const divider = "=".repeat(RECEIPT_WIDTH);
  const thinDivider = "-".repeat(RECEIPT_WIDTH);
  const phone = shopPhone();

  const lines = [
    divider,
    centerText(shopName()),
    divider,
    "",
    formatLabelLine("Date", data.date),
    formatLabelLine("Bill No", data.billNo),
    "",
    itemHeader(),
    thinDivider,
    ...data.items.map(itemLine),
    thinDivider,
    totalLine(data.total),
    "",
  ];

  if (phone) {
    lines.push(formatLabelLine("Call", formatMobileDisplay(phone)));
  }

  lines.push("", thinDivider, centerText("Thank you - visit again"), thinDivider);

  return lines.join("\n");
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function escPosInit(): Uint8Array {
  return new Uint8Array([0x1b, 0x40]);
}

function escPosAlign(mode: 0 | 1 | 2): Uint8Array {
  return new Uint8Array([0x1b, 0x61, mode]);
}

function escPosBold(on: boolean): Uint8Array {
  return new Uint8Array([0x1b, 0x45, on ? 0x01 : 0x00]);
}

function escPosFeedEnd(feedLines = 8): Uint8Array {
  return new Uint8Array([0x1b, 0x64, Math.min(255, Math.max(0, feedLines))]);
}

function escPosText(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export function buildEscPosSaleReceipt(data: SaleReceiptData): Uint8Array {
  const divider = "=".repeat(RECEIPT_WIDTH);
  const thinDivider = "-".repeat(RECEIPT_WIDTH);
  const phone = shopPhone();
  const phoneLine = phone ? `${formatLabelLine("Call", formatMobileDisplay(phone))}\n` : "";

  return concatBytes(
    escPosInit(),
    escPosAlign(1),
    escPosText(`${divider}\n`),
    escPosBold(true),
    escPosText(`${shopName()}\n`),
    escPosBold(false),
    escPosText(`${divider}\n\n`),
    escPosAlign(0),
    escPosText(`${formatLabelLine("Date", data.date)}\n`),
    escPosText(`${"Bill No".padEnd(LABEL_WIDTH, " ")}: `),
    escPosBold(true),
    escPosText(`${data.billNo}\n`),
    escPosBold(false),
    escPosText(`\n${itemHeader()}\n${thinDivider}\n`),
    escPosText(`${data.items.map(itemLine).join("\n")}\n`),
    escPosText(`${thinDivider}\n`),
    escPosBold(true),
    escPosText(`${totalLine(data.total)}\n`),
    escPosBold(false),
    escPosText(`\n${phoneLine}`),
    escPosText(`\n${thinDivider}\n`),
    escPosAlign(1),
    escPosText("Thank you - visit again\n"),
    escPosAlign(0),
    escPosText(`${thinDivider}\n\n`),
    escPosFeedEnd(8),
  );
}
