import { resolve } from "node:path";

export type BridgeConfig = {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  branchId: string;
  printerId: string;
  printerIp: string;
  printerPort: number;
  printerName: string;
  healthPort: number;
  logDir: string;
  appUrl: string;
  shopName: string;
  shopPhone: string;
};

function normalizeSupabaseUrl(raw: string): string {
  return raw.replace(/\/rest\/v1\/?$/i, "").replace(/\/+$/, "");
}

function envFirst(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return "";
}

export function loadConfig(): BridgeConfig {
  const supabaseUrl = normalizeSupabaseUrl(process.env.SUPABASE_URL?.trim() ?? "");
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  const branchId = envFirst("BRANCH_ID", "PRINT_BRANCH_ID") || "main";
  const printerId = envFirst("PRINTER_ID", "PRINT_PRINTER_ID") || "counter-1";
  const printerIp = envFirst("PRINTER_IP", "THERMAL_PRINTER_HOST");
  const printerPort = parseInt(envFirst("PRINTER_PORT", "THERMAL_PRINTER_PORT") || "9100", 10);
  const printerName = envFirst("PRINTER_NAME") || printerId;
  const healthPort = parseInt(process.env.HEALTH_PORT?.trim() || "3005", 10);
  const logDir = resolve(process.cwd(), process.env.LOG_DIR?.trim() || "logs");

  if (!supabaseUrl) {
    throw new Error(
      "SUPABASE_URL is required — add it to .env (see .env.shop.example). " +
        "Get it from Supabase Dashboard → Settings → API → Project URL."
    );
  }
  if (!supabaseServiceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required — add it to .env. " +
        "Get it from Supabase Dashboard → Settings → API → service_role (secret)."
    );
  }
  if (!printerIp) {
    throw new Error("PRINTER_IP is required in .env (LAN address of the thermal printer).");
  }

  return {
    supabaseUrl,
    supabaseServiceRoleKey,
    branchId,
    printerId,
    printerIp,
    printerPort,
    printerName,
    healthPort,
    logDir,
    appUrl:
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      process.env.PRINT_AGENT_APP_URL?.trim() ||
      "https://uma-service.vercel.app",
    shopName: process.env.NEXT_PUBLIC_SHOP_NAME?.trim() || "Uma Traders",
    shopPhone: process.env.NEXT_PUBLIC_SHOP_PHONE?.trim() || "",
  };
}
