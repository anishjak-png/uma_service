import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BridgeState } from "./bridge-state";
import { ConnectivityMonitor } from "./connectivity-monitor";
import { loadConfig } from "./config";
import { HealthServer } from "./health-server";
import { BridgeLogger, log } from "./logger";
import { LanPrinter } from "./printer";
import { PrintQueueManager } from "./print-queue-manager";
import { RealtimeManager } from "./realtime-manager";
import { BRIDGE_VERSION } from "./version";

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

async function main() {
  const config = loadConfig();
  const logger = new BridgeLogger(config.logDir);
  const state = new BridgeState(config);

  logger.info(log.started());
  logger.info(`  Version: ${BRIDGE_VERSION}`);
  logger.info(`  Branch:  ${config.branchId}`);
  logger.info(`  Printer: ${config.printerName} @ ${config.printerIp}:${config.printerPort}`);
  logger.info(`  Health:  http://127.0.0.1:${config.healthPort}`);
  logger.info(`  Mode:    Supabase Realtime (no polling)`);

  const supabase = RealtimeManager.createSupabase(config);
  const printer = new LanPrinter(config);
  const queue = new PrintQueueManager(supabase, config, printer, state, logger);
  const realtime = new RealtimeManager(config, supabase, queue, state, logger);
  const health = new HealthServer(config, state);
  const connectivity = new ConnectivityMonitor(
    config,
    supabase,
    printer,
    state,
    realtime,
    logger
  );

  health.start();
  state.setRunning(true);

  const printerOk = await printer.ping();
  state.setPrinterConnected(printerOk);
  if (!printerOk) {
    logger.warn("Printer not reachable at startup — will retry automatically");
  }

  realtime.start();
  connectivity.start();

  const shutdown = () => {
    logger.info("Print Bridge stopping…");
    connectivity.stop();
    realtime.stop();
    health.stop();
    state.setRunning(false);
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
