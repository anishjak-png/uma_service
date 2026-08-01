import { getAppUrl, SHOP_NAME, SHOP_PHONE } from "./constants";
import {
  formatAccessoryLabel,
  formatMobileDisplay,
  parseAccessories,
  toTrackingPathSlug,
} from "./jobs";

export interface ReceiptData {
  jobNumber: string;
  date: string;
  mobile: string;
  customerName?: string | null;
  applianceType: string;
  brand?: string | null;
  model?: string | null;
  complaint: string;
  accessories?: string[] | null;
  statusUrl: string;
}

const RECEIPT_WIDTH = 42;
const LABEL_WIDTH = 10;

export function buildReceiptData(job: {
  jobNumber: string;
  receivedAt: Date;
  customer: { mobile: string; name?: string | null };
  applianceType: string;
  brand?: string | null;
  model?: string | null;
  complaint: string;
  accessories?: string | null;
}): ReceiptData {
  return {
    jobNumber: job.jobNumber,
    date: job.receivedAt.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    mobile: job.customer.mobile,
    customerName: job.customer.name,
    applianceType: job.applianceType,
    brand: job.brand,
    model: job.model,
    complaint: job.complaint,
    accessories: parseAccessories(job.accessories).map(formatAccessoryLabel),
    statusUrl: `${getAppUrl()}/j/${toTrackingPathSlug(job.jobNumber)}`,
  };
}

function centerText(text: string, width = RECEIPT_WIDTH): string {
  const pad = Math.max(0, Math.floor((width - text.length) / 2));
  return " ".repeat(pad) + text;
}

function formatLabelLine(label: string, value: string): string {
  return `${label.padEnd(LABEL_WIDTH, " ")}: ${value}`;
}

function truncateValue(value: string, maxLen: number): string {
  if (value.length <= maxLen) return value;
  return value.slice(0, maxLen - 3) + "...";
}

function buildJobMobileEscPos(data: ReceiptData): Uint8Array {
  const mobileDisplay = formatMobileDisplay(data.mobile);
  return concatBytes(
    escPosText(`${"Job No".padEnd(LABEL_WIDTH, " ")}: `),
    escPosBold(true),
    escPosText(`${data.jobNumber}\n`),
    escPosBold(false),
    escPosText(`${"Mobile".padEnd(LABEL_WIDTH, " ")}: `),
    escPosBold(true),
    escPosText(`${mobileDisplay}\n`),
    escPosBold(false)
  );
}

function buildDetailLines(data: ReceiptData): string[] {
  const productParts = [data.brand, data.applianceType, data.model].filter(Boolean);
  const product = truncateValue(productParts.join(" "), RECEIPT_WIDTH - LABEL_WIDTH - 2);
  const complaint = truncateValue(data.complaint, RECEIPT_WIDTH - LABEL_WIDTH - 2);

  const lines: string[] = [];

  if (data.customerName) {
    lines.push(
      formatLabelLine("Customer", truncateValue(data.customerName, RECEIPT_WIDTH - LABEL_WIDTH - 2))
    );
  }

  lines.push(
    "",
    formatLabelLine("Product", product),
    formatLabelLine("Complaint", complaint)
  );

  if (data.accessories && data.accessories.length > 0) {
    const accessoriesText = truncateValue(
      data.accessories.join(", "),
      RECEIPT_WIDTH - LABEL_WIDTH - 2
    );
    lines.push(formatLabelLine("Accessories", accessoriesText));
  }

  return lines;
}

/** Plain-text receipt for browser preview / PDF (80mm layout) */
export function formatReceiptText80mm(data: ReceiptData): string {
  const divider = "=".repeat(RECEIPT_WIDTH);
  const thinDivider = "-".repeat(RECEIPT_WIDTH);

  const lines = [
    divider,
    centerText(SHOP_NAME),
    divider,
    "",
    formatLabelLine("Date", data.date),
    "",
    formatLabelLine("Job No", data.jobNumber),
    formatLabelLine("Mobile", formatMobileDisplay(data.mobile)),
    ...buildDetailLines(data),
    "",
  ];

  if (SHOP_PHONE) {
    lines.push(formatLabelLine("Call", formatMobileDisplay(SHOP_PHONE)));
  }

  lines.push(
    formatLabelLine("Terms", "Collect within 30 days"),
    "",
    thinDivider,
    centerText("Customer copy - keep safe"),
    thinDivider
  );

  return lines.join("\n");
}

export function formatReceiptText(data: ReceiptData): string {
  return formatReceiptText80mm(data);
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const totalLength = parts.reduce((sum, p) => sum + p.length, 0);
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

/** Full ESC/POS receipt buffer for 80mm LAN thermal printers */
export function buildEscPosReceipt(data: ReceiptData): Buffer {
  const divider = "=".repeat(RECEIPT_WIDTH);
  const thinDivider = "-".repeat(RECEIPT_WIDTH);
  const detailLines = buildDetailLines(data);

  const footerParts = [
    ...(SHOP_PHONE
      ? [`${formatLabelLine("Call", formatMobileDisplay(SHOP_PHONE))}\n`]
      : []),
    `${formatLabelLine("Terms", "Collect within 30 days")}\n`,
    `\n${thinDivider}\n`,
    `${centerText("Customer copy - keep safe")}\n`,
    `${thinDivider}\n\n`,
  ];

  const receipt = concatBytes(
    escPosInit(),
    escPosAlign(1),
    escPosText(`${divider}\n`),
    escPosBold(true),
    escPosText(`${SHOP_NAME}\n`),
    escPosBold(false),
    escPosText(`${divider}\n\n`),
    escPosAlign(0),
    escPosText(`${formatLabelLine("Date", data.date)}\n\n`),
    buildJobMobileEscPos(data),
    escPosText(`\n${detailLines.join("\n")}\n\n`),
    escPosText(footerParts.join("")),
    escPosFeedEnd(8)
  );

  return Buffer.from(receipt);
}

/** ESC/POS encoder for Bluetooth fallback */
export function encodeEscPos(text: string): Uint8Array {
  return concatBytes(escPosInit(), escPosAlign(0), escPosText(`${text}\n`), escPosFeedEnd(8));
}
