import { APP_URL, SHOP_NAME, SHOP_PHONE } from "./constants";
import { formatMobileDisplay } from "./jobs";

export interface ReceiptData {
  jobNumber: string;
  date: string;
  mobile: string;
  customerName?: string | null;
  applianceType: string;
  brand?: string | null;
  model?: string | null;
  complaint: string;
  statusUrl: string;
}

export function buildReceiptData(job: {
  jobNumber: string;
  receivedAt: Date;
  customer: { mobile: string; name?: string | null };
  applianceType: string;
  brand?: string | null;
  model?: string | null;
  complaint: string;
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
    statusUrl: `${APP_URL}/j/${encodeURIComponent(job.jobNumber)}`,
  };
}

function wrapLine(label: string, value: string, width = 48): string {
  const prefix = `${label} : `;
  const maxValue = width - prefix.length;
  if (value.length <= maxValue) {
    return prefix + value;
  }
  return prefix + value.slice(0, maxValue - 3) + "...";
}

/** Plain-text receipt for browser preview / PDF (80mm layout) */
export function formatReceiptText80mm(data: ReceiptData): string {
  const productParts = [data.brand, data.applianceType, data.model].filter(Boolean);
  const product = productParts.join(" ");

  const divider = "=".repeat(42);
  const lines = [
    divider,
    SHOP_NAME.toUpperCase().padStart((42 + SHOP_NAME.length) / 2),
    "Home Appliance Service".padStart(33),
    divider,
    wrapLine("Job No", data.jobNumber),
    wrapLine("Date", data.date),
    wrapLine("Mobile", formatMobileDisplay(data.mobile)),
  ];

  if (data.customerName) {
    lines.push(wrapLine("Customer", data.customerName));
  }

  lines.push(
    "",
    wrapLine("Product", product),
    wrapLine("Complaint", data.complaint),
    "",
    "Scan QR to track status:",
    data.statusUrl,
    "",
    SHOP_PHONE ? `Call: ${formatMobileDisplay(SHOP_PHONE)}` : "",
    "Terms: Collect within 30 days",
    divider,
    "Customer copy — keep safe".padStart(33),
    divider
  );

  return lines.filter((l) => l !== "").join("\n");
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

function escPosFeedCut(): Uint8Array {
  return new Uint8Array([0x0a, 0x0a, 0x0a, 0x1d, 0x56, 0x00]);
}

function escPosText(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/** ESC/POS QR code (model 2) */
function escPosQrCode(url: string): Uint8Array {
  const data = new TextEncoder().encode(url);
  const storeLen = data.length + 3;
  const pL = storeLen & 0xff;
  const pH = (storeLen >> 8) & 0xff;

  const store = new Uint8Array([
    0x1d, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30,
    ...data,
  ]);
  const print = new Uint8Array([
    0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30,
  ]);
  const model = new Uint8Array([0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]);
  const size = new Uint8Array([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 0x06]);
  const error = new Uint8Array([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31]);

  return concatBytes(model, size, error, store, print);
}

function buildReceiptBodyText(data: ReceiptData): string {
  const productParts = [data.brand, data.applianceType, data.model].filter(Boolean);
  const product = productParts.join(" ");
  const divider = "=".repeat(42);

  const lines = [
    divider,
    wrapLine("Job No", data.jobNumber),
    wrapLine("Date", data.date),
    wrapLine("Mobile", formatMobileDisplay(data.mobile)),
  ];

  if (data.customerName) {
    lines.push(wrapLine("Customer", data.customerName));
  }

  lines.push(
    "",
    wrapLine("Product", product),
    wrapLine("Complaint", data.complaint),
    ""
  );

  return lines.join("\n");
}

/** Full ESC/POS receipt buffer for 80mm LAN thermal printers */
export function buildEscPosReceipt(data: ReceiptData): Buffer {
  const divider = "=".repeat(42);
  const footer = [
    SHOP_PHONE ? `Call: ${formatMobileDisplay(SHOP_PHONE)}\n` : "",
    "Terms: Collect within 30 days\n",
    `${divider}\n`,
    "Customer copy — keep safe\n",
    `${divider}\n`,
  ].join("");

  const receipt = concatBytes(
    escPosInit(),
    escPosAlign(1),
    escPosBold(true),
    escPosText(`${SHOP_NAME}\nHome Appliance Service\n\n`),
    escPosBold(false),
    escPosAlign(0),
    escPosText(buildReceiptBodyText(data)),
    escPosAlign(1),
    escPosText("\nScan to track status:\n\n"),
    escPosQrCode(data.statusUrl),
    escPosText("\n\n"),
    escPosAlign(0),
    escPosText(footer),
    escPosFeedCut()
  );

  return Buffer.from(receipt);
}

/** Simple ESC/POS encoder for Bluetooth fallback */
export function encodeEscPos(text: string): Uint8Array {
  const init = escPosInit();
  const header = concatBytes(
    escPosAlign(1),
    escPosBold(true),
    escPosText(`${SHOP_NAME}\nHome Appliance Service\n\n`),
    escPosBold(false),
    escPosAlign(0),
    escPosText(text),
    escPosFeedCut()
  );
  return concatBytes(init, header);
}
