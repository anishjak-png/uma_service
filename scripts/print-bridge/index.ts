import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfig } from "./config";

/** Fallback if `tsx --env-file=.env` did not load (e.g. wrong cwd on shop PC). */
function loadDotEnvFallback(): void {
  if (process.env.SUPABASE_URL?.trim()) return;
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (process.env[key]) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadDotEnvFallback();
import { log } from "./logger";
import { LanPrinter } from "./printer";
import { PrintQueueManager } from "./print-queue-manager";
import { RealtimeManager } from "./realtime-manager";

async function main() {
  const config = loadConfig();
  log.started();
  console.log(`  Branch:  ${config.branchId}`);
  console.log(`  Printer: ${config.printerId} @ ${config.printerHost}:${config.printerPort}`);
  console.log(`  Supabase Realtime — no polling`);

  const supabase = RealtimeManager.createSupabase(config);
  const printer = new LanPrinter(config);
  const queue = new PrintQueueManager(supabase, config, printer);
  const realtime = new RealtimeManager(config, supabase, queue);

  realtime.start();
  queue.startPeriodicSync();

  const shutdown = () => {
    console.log("Print Bridge stopping…");
    queue.stopPeriodicSync();
    realtime.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
