import type { SupabaseClient } from "@supabase/supabase-js";
import type { BridgeState } from "./bridge-state";
import type { BridgeConfig } from "./config";
import { log, type BridgeLogger } from "./logger";
import { LanPrinter } from "./printer";
import { buildReceiptBuffer } from "./receipt";
import { buildSaleReceiptBuffer } from "./sale-receipt";
import type { JobCardRow, PrintJobRow, QueuedPrintJob } from "./types";

export class PrintQueueManager {
  private readonly processedIds = new Set<string>();
  private readonly inFlightIds = new Set<string>();
  private readonly queue: QueuedPrintJob[] = [];
  private processing = false;
  private syncing = false;

  constructor(
    private readonly supabase: SupabaseClient,
    private readonly config: BridgeConfig,
    private readonly printer: LanPrinter,
    private readonly state: BridgeState,
    private readonly logger: BridgeLogger
  ) {}

  /** Called by RealtimeManager when a new INSERT passes filters. */
  enqueueFromEvent(row: PrintJobRow, jobNumber?: string): void {
    if (row.status !== "Pending") {
      this.logger.info(log.skipped(row.id, `status is ${row.status}`));
      return;
    }

    if (row.branchId !== this.config.branchId) {
      this.logger.info(log.skipped(row.id, `branch ${row.branchId} != ${this.config.branchId}`));
      return;
    }

    if (row.printerId !== this.config.printerId) {
      this.logger.info(log.skipped(row.id, `printer ${row.printerId} != ${this.config.printerId}`));
      return;
    }

    this.tryEnqueue(row.id, jobNumber ?? row.id);
  }

  private tryEnqueue(id: string, jobNumber: string): boolean {
    if (this.processedIds.has(id) || this.inFlightIds.has(id)) {
      this.logger.info(log.duplicateIgnored(id));
      return false;
    }

    if (this.queue.some((item) => item.id === id)) {
      this.logger.info(log.duplicateIgnored(id));
      return false;
    }

    this.queue.push({ id, jobNumber });
    this.updateQueueLength();
    void this.drain();
    return true;
  }

  /** Fetch all Pending jobs for this branch/printer after reconnect — FIFO. */
  async syncMissedJobs(): Promise<void> {
    if (this.syncing) return;
    this.syncing = true;

    try {
      const { data, error } = await this.supabase
        .from("PrintJob")
        .select(
          "id, jobCardId, type, payload, status, branchId, printerId, attempts, errorMessage, createdAt, printedAt"
        )
        .eq("status", "Pending")
        .eq("branchId", this.config.branchId)
        .eq("printerId", this.config.printerId)
        .order("createdAt", { ascending: true });

      if (error) {
        this.logger.error(`Missed jobs sync failed: ${error.message}`);
        this.state.setLastError(`Missed jobs sync: ${error.message}`);
        return;
      }

      const rows = (data ?? []) as PrintJobRow[];
      let added = 0;

      for (const row of rows) {
        if (this.tryEnqueue(row.id, row.id)) added++;
      }

      if (added > 0) {
        this.logger.info(log.missedSynced(added));
      }
    } finally {
      this.syncing = false;
    }
  }

  private updateQueueLength(): void {
    this.state.setQueueLength(this.queue.length + (this.processing ? 1 : 0));
  }

  private async drain(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    this.updateQueueLength();

    try {
      while (this.queue.length > 0) {
        const next = this.queue.shift();
        if (!next) break;
        this.updateQueueLength();
        await this.processJob(next.id);
      }
    } finally {
      this.processing = false;
      this.updateQueueLength();
      if (this.queue.length > 0) {
        void this.drain();
      }
    }
  }

  private async processJob(id: string): Promise<void> {
    if (this.processedIds.has(id) || this.inFlightIds.has(id)) {
      this.logger.info(log.duplicateIgnored(id));
      return;
    }

    this.inFlightIds.add(id);

    const { data: printJob, error: jobError } = await this.supabase
      .from("PrintJob")
      .select(
        "id, jobCardId, type, payload, status, branchId, printerId, attempts, errorMessage, createdAt, printedAt"
      )
      .eq("id", id)
      .single();

    if (jobError || !printJob) {
      this.logger.error(`Could not load PrintJob ${id}: ${jobError?.message ?? "unknown"}`);
      this.inFlightIds.delete(id);
      return;
    }

    const row = printJob as PrintJobRow;

    if (row.status !== "Pending") {
      this.logger.info(log.skipped(id, `status is ${row.status}`));
      this.processedIds.add(id);
      this.inFlightIds.delete(id);
      return;
    }

    if (row.branchId !== this.config.branchId || row.printerId !== this.config.printerId) {
      this.logger.info(log.skipped(id, "branch/printer mismatch"));
      this.inFlightIds.delete(id);
      return;
    }

    const { data: claimed, error: claimError } = await this.supabase
      .from("PrintJob")
      .update({ status: "Printing", attempts: row.attempts + 1 })
      .eq("id", id)
      .eq("status", "Pending")
      .select("id")
      .maybeSingle();

    if (claimError || !claimed) {
      this.logger.info(log.skipped(id, claimError?.message ?? "already claimed"));
      this.processedIds.add(id);
      this.inFlightIds.delete(id);
      return;
    }

    if (row.type === "sale") {
      this.logger.info(log.printing(`sale:${isSaleBillNo(row.payload)}`));
      try {
        const buffer = buildSaleReceiptBuffer(row.payload, this.config);
        await this.printer.print(buffer);
        await this.markPrinted(id);
        this.processedIds.add(id);
        this.state.setLastPrinted(isSaleBillNo(row.payload));
        this.logger.info(log.success(isSaleBillNo(row.payload)));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Print failed";
        await this.markFailed(id, message);
        this.processedIds.add(id);
        this.state.setLastError(message);
        this.logger.error(log.failed(isSaleBillNo(row.payload), message));
      } finally {
        this.inFlightIds.delete(id);
      }
      return;
    }

    if (!row.jobCardId) {
      const msg = "Job card not found";
      await this.markFailed(id, msg);
      this.processedIds.add(id);
      this.state.setLastError(msg);
      this.inFlightIds.delete(id);
      return;
    }

    const { data: jobCard, error: cardError } = await this.supabase
      .from("JobCard")
      .select("jobNumber, receivedAt, applianceType, brand, model, complaint, Customer(mobile, name)")
      .eq("id", row.jobCardId)
      .single();

    if (cardError || !jobCard) {
      const msg = cardError?.message ?? "Job card not found";
      await this.markFailed(id, msg);
      this.processedIds.add(id);
      this.state.setLastError(msg);
      this.inFlightIds.delete(id);
      return;
    }

    const raw = jobCard as JobCardRow & {
      Customer: JobCardRow["Customer"] | JobCardRow["Customer"][];
    };
    const customer = Array.isArray(raw.Customer) ? raw.Customer[0] : raw.Customer;
    const card: JobCardRow = { ...raw, Customer: customer ?? null };
    this.logger.info(log.printing(card.jobNumber));

    try {
      const buffer = buildReceiptBuffer(card, this.config);
      await this.printer.print(buffer);
      await this.markPrinted(id);
      this.processedIds.add(id);
      this.state.setLastPrinted(card.jobNumber);
      this.logger.info(log.success(card.jobNumber));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Print failed";
      await this.markFailed(id, message);
      this.processedIds.add(id);
      this.state.setLastError(message);
      this.logger.error(log.failed(card.jobNumber, message));
    } finally {
      this.inFlightIds.delete(id);
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

function isSaleBillNo(payload: unknown): string {
  if (payload && typeof payload === "object" && "billNo" in payload) {
    const billNo = (payload as { billNo?: unknown }).billNo;
    if (typeof billNo === "string" && billNo) return billNo;
  }
  return "sale";
}
