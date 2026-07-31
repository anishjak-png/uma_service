import type { SupabaseClient } from "@supabase/supabase-js";
import type { BridgeConfig } from "./config";
import { log } from "./logger";
import { LanPrinter } from "./printer";
import { buildReceiptBuffer } from "./receipt";
import type { JobCardRow, PrintJobRow, QueuedPrintJob } from "./types";

type JobHandler = (job: PrintJobRow) => void;

export class PrintQueueManager {
  private readonly processedIds = new Set<string>();
  private readonly queue: QueuedPrintJob[] = [];
  private processing = false;

  constructor(
    private readonly supabase: SupabaseClient,
    private readonly config: BridgeConfig,
    private readonly printer: LanPrinter
  ) {}

  /** Called by RealtimeManager when a new INSERT passes filters. */
  enqueueFromEvent(row: PrintJobRow, jobNumber?: string): void {
    if (this.processedIds.has(row.id)) {
      log.duplicateIgnored(row.id);
      return;
    }

    if (row.status !== "Pending") {
      log.skipped(row.id, `status is ${row.status}`);
      return;
    }

    if (row.branchId !== this.config.branchId) {
      log.skipped(row.id, `branch ${row.branchId} != ${this.config.branchId}`);
      return;
    }

    if (row.printerId !== this.config.printerId) {
      log.skipped(row.id, `printer ${row.printerId} != ${this.config.printerId}`);
      return;
    }

    if (this.queue.some((item) => item.id === row.id)) {
      log.duplicateIgnored(row.id);
      return;
    }

    this.queue.push({ id: row.id, jobNumber: jobNumber ?? row.id });
    void this.drain();
  }

  /** Safety net if Realtime misses an INSERT (e.g. brief disconnect). Not HTTP polling. */
  startPeriodicSync(intervalMs = 15_000): void {
    this.syncTimer = setInterval(() => {
      void this.syncMissedJobs();
    }, intervalMs);
  }

  stopPeriodicSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  private syncTimer: ReturnType<typeof setInterval> | null = null;

  /** Fetch missed pending jobs after reconnect — FIFO, no polling loop. */
  async syncMissedJobs(): Promise<void> {
    const { data, error } = await this.supabase
      .from("PrintJob")
      .select("id, jobCardId, type, status, branchId, printerId, attempts, errorMessage, createdAt, printedAt")
      .eq("status", "Pending")
      .eq("branchId", this.config.branchId)
      .eq("printerId", this.config.printerId)
      .order("createdAt", { ascending: true });

    if (error) {
      console.error("Missed jobs sync failed:", error.message);
      return;
    }

    const rows = (data ?? []) as PrintJobRow[];
    let added = 0;

    for (const row of rows) {
      if (this.processedIds.has(row.id)) continue;
      if (this.queue.some((item) => item.id === row.id)) continue;
      this.queue.push({ id: row.id, jobNumber: row.id });
      added++;
    }

    if (added > 0) {
      log.missedSynced(added);
      void this.drain();
    }
  }

  private async drain(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    try {
      while (this.queue.length > 0) {
        const next = this.queue.shift();
        if (!next) break;
        await this.processJob(next.id);
      }
    } finally {
      this.processing = false;
      if (this.queue.length > 0) {
        void this.drain();
      }
    }
  }

  private async processJob(id: string): Promise<void> {
    if (this.processedIds.has(id)) {
      log.duplicateIgnored(id);
      return;
    }

    const { data: printJob, error: jobError } = await this.supabase
      .from("PrintJob")
      .select("id, jobCardId, type, status, branchId, printerId, attempts, errorMessage, createdAt, printedAt")
      .eq("id", id)
      .single();

    if (jobError || !printJob) {
      console.error(`Could not load PrintJob ${id}:`, jobError?.message);
      return;
    }

    const row = printJob as PrintJobRow;

    if (row.status !== "Pending") {
      log.skipped(id, `status is ${row.status}`);
      this.processedIds.add(id);
      return;
    }

    if (row.branchId !== this.config.branchId || row.printerId !== this.config.printerId) {
      log.skipped(id, "branch/printer mismatch");
      return;
    }

    const { data: jobCard, error: cardError } = await this.supabase
      .from("JobCard")
      .select("jobNumber, receivedAt, applianceType, brand, model, complaint, Customer(mobile, name)")
      .eq("id", row.jobCardId)
      .single();

    if (cardError || !jobCard) {
      await this.markFailed(id, cardError?.message ?? "Job card not found");
      return;
    }

    const raw = jobCard as JobCardRow & { Customer: JobCardRow["Customer"] | JobCardRow["Customer"][] };
    const customer = Array.isArray(raw.Customer) ? raw.Customer[0] : raw.Customer;
    const card: JobCardRow = { ...raw, Customer: customer ?? null };
    log.printing(card.jobNumber);

    await this.supabase
      .from("PrintJob")
      .update({ status: "Printing", attempts: row.attempts + 1 })
      .eq("id", id)
      .eq("status", "Pending");

    try {
      const buffer = buildReceiptBuffer(card, this.config);
      await this.printer.print(buffer);
      await this.markPrinted(id);
      this.processedIds.add(id);
      log.success(card.jobNumber);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Print failed";
      await this.markFailed(id, message);
      this.processedIds.add(id);
      log.failed(card.jobNumber, message);
    }
  }

  private async markPrinted(id: string): Promise<void> {
    await this.supabase
      .from("PrintJob")
      .update({
        status: "Printed",
        printedAt: new Date().toISOString(),
        errorMessage: null,
      })
      .eq("id", id);
  }

  private async markFailed(id: string, errorMessage: string): Promise<void> {
    await this.supabase
      .from("PrintJob")
      .update({
        status: "Failed",
        errorMessage,
      })
      .eq("id", id);
  }
}
