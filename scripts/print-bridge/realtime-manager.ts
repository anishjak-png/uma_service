import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import type { BridgeConfig } from "./config";
import { log } from "./logger";
import type { PrintQueueManager } from "./print-queue-manager";
import type { PrintJobRow } from "./types";

export class RealtimeManager {
  private channel: RealtimeChannel | null = null;
  private connected = false;

  constructor(
    private readonly config: BridgeConfig,
    private readonly supabase: SupabaseClient,
    private readonly queue: PrintQueueManager
  ) {}

  start(): void {
    this.subscribe();
  }

  stop(): void {
    if (this.channel) {
      void this.supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.connected = false;
  }

  private subscribe(): void {
    if (this.channel) {
      void this.supabase.removeChannel(this.channel);
    }

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
          log.newJob(row.id);
          this.queue.enqueueFromEvent(row);
        }
      )
      .subscribe((status, err) => {
        if (status !== "SUBSCRIBED") {
          console.log(`Realtime channel status: ${status}${err ? ` — ${err.message}` : ""}`);
        }
        if (status === "SUBSCRIBED") {
          if (this.connected) {
            log.realtimeReconnected();
          } else {
            log.realtimeConnected();
          }
          this.connected = true;
          void this.queue.syncMissedJobs();
          return;
        }

        if (status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          if (this.connected) {
            log.realtimeDisconnected();
          }
          this.connected = false;
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
