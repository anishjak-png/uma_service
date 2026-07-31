export type BridgeConfig = {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  branchId: string;
  printerId: string;
  printerHost: string;
  printerPort: number;
  appUrl: string;
  shopName: string;
  shopPhone: string;
};

function normalizeSupabaseUrl(raw: string): string {
  return raw.replace(/\/rest\/v1\/?$/i, "").replace(/\/+$/, "");
}

export function loadConfig(): BridgeConfig {
  const supabaseUrl = normalizeSupabaseUrl(process.env.SUPABASE_URL?.trim() ?? "");
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  const branchId = process.env.PRINT_BRANCH_ID?.trim() || "main";
  const printerId = process.env.PRINT_PRINTER_ID?.trim() || "counter-1";
  const printerHost = process.env.THERMAL_PRINTER_HOST?.trim() ?? "";
  const printerPort = parseInt(process.env.THERMAL_PRINTER_PORT ?? "9100", 10);

  if (!supabaseUrl) {
    throw new Error(
      "SUPABASE_URL is required — add it to .env on this PC (see .env.shop.example). " +
        "Get it from Supabase Dashboard → Settings → API → Project URL."
    );
  }
  if (!supabaseServiceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required — add it to .env on this PC. " +
        "Get it from Supabase Dashboard → Settings → API → service_role (secret)."
    );
  }
  if (!printerHost) throw new Error("THERMAL_PRINTER_HOST is required");

  return {
    supabaseUrl,
    supabaseServiceRoleKey,
    branchId,
    printerId,
    printerHost,
    printerPort,
    appUrl:
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      process.env.PRINT_AGENT_APP_URL?.trim() ||
      "https://uma-service.vercel.app",
    shopName: process.env.NEXT_PUBLIC_SHOP_NAME?.trim() || "Uma Traders",
    shopPhone: process.env.NEXT_PUBLIC_SHOP_PHONE?.trim() || "",
  };
}
