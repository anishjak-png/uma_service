import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import type { BridgeState } from "./bridge-state";
import type { BridgeConfig } from "./config";
import { log, type BridgeLogger } from "./logger";
import type { PrintQueueManager } from "./print-queue-manager";
import type { PrintJobRow } from "./types";

const MAX_RECONNECT_DELAY_MS = 30_000;

export class RealtimeManager {
  private channel: RealtimeChannel | null = null;
  private connected = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private stopped = false;

  constructor(
    private readonly config: BridgeConfig,
    private readonly supabase: SupabaseClient,
    private readonly queue: PrintQueueManager,
    private readonly state: BridgeState,
    private readonly logger: BridgeLogger
  ) {}

  start(): void {
    this.stopped = false;
    this.subscribe();
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.channel) {
      void this.supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.connected = false;
    this.state.setRealtimeConnected(false);
  }

  reconnect(): void {
    if (this.stopped) return;
    this.scheduleReconnect(0);
  }

  isConnected(): boolean {
    return this.connected;
  }

  private scheduleReconnect(delayMs?: number): void {
    if (this.stopped || this.reconnectTimer) return;

    const delay =
      delayMs ??
      Math.min(MAX_RECONNECT_DELAY_MS, 1000 * Math.pow(2, this.reconnectAttempts));
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.channel) {
        void this.supabase.removeChannel(this.channel);
        this.channel = null;
      }
      this.connected = false;
      this.state.setRealtimeConnected(false);
      this.subscribe();
    }, delay);
  }

  private subscribe(): void {
    if (this.stopped) return;

    this.channel = this.supabase
      .channel(`print-bridge-${this.config.branchId}-${this.config.printerId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "PrintJob",
        },
        (payload) => {
          const row = payload.new as PrintJobRow;
          this.logger.info(log.newJob(row.id));
          this.queue.enqueueFromEvent(row);
        }
      )
      .subscribe((status, err) => {
        if (status !== "SUBSCRIBED") {
          this.logger.warn(`Realtime channel status: ${status}${err ? ` — ${err.message}` : ""}`);
        }

        if (status === "SUBSCRIBED") {
          const wasConnected = this.connected;
          this.connected = true;
          this.reconnectAttempts = 0;
          this.state.setRealtimeConnected(true);

          if (wasConnected) {
            this.logger.info(log.realtimeReconnected());
          } else {
            this.logger.info(log.realtimeConnected());
          }

          void this.queue.syncMissedJobs();
          return;
        }

        if (status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          if (this.connected) {
            this.logger.warn(log.realtimeDisconnected());
          }
          this.connected = false;
          this.state.setRealtimeConnected(false);
          this.scheduleReconnect();
        }
      });
  }

  static createSupabase(config: BridgeConfig): SupabaseClient {
    return createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { params: { eventsPerSecond: 10 } },
    });
  }
}
