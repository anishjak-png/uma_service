import type { SupabaseClient } from "@supabase/supabase-js";
import type { BridgeState } from "./bridge-state";
import type { BridgeConfig } from "./config";
import type { BridgeLogger } from "./logger";
import type { LanPrinter } from "./printer";
import type { RealtimeManager } from "./realtime-manager";

const HEARTBEAT_MS = 30_000;

/** Monitors Supabase + printer reachability; triggers reconnect when needed. */
export class ConnectivityMonitor {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly config: BridgeConfig,
    private readonly supabase: SupabaseClient,
    private readonly printer: LanPrinter,
    private readonly state: BridgeState,
    private readonly realtime: RealtimeManager,
    private readonly logger: BridgeLogger
  ) {}

  start(): void {
    void this.tick();
    this.timer = setInterval(() => void this.tick(), HEARTBEAT_MS);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick(): Promise<void> {
    this.state.touch();

    const [supabaseOk, printerOk] = await Promise.all([
      this.pingSupabase(),
      this.printer.ping(),
    ]);

    this.state.setSupabaseConnected(supabaseOk);
    this.state.setPrinterConnected(printerOk);

    if (!supabaseOk) {
      this.logger.warn("Supabase unreachable — will reconnect Realtime when available");
      if (!this.realtime.isConnected()) {
        this.realtime.reconnect();
      }
    }
  }

  private async pingSupabase(): Promise<boolean> {
    try {
      const { error } = await this.supabase.from("PrintJob").select("id").limit(1);
      return !error;
    } catch {
      return false;
    }
  }
}
