import type { BridgeConfig } from "./config";
import { BRIDGE_VERSION } from "./version";

export type BridgeHealthSnapshot = {
  version: string;
  bridgeRunning: boolean;
  realtimeConnected: boolean;
  supabaseConnected: boolean;
  printerConnected: boolean;
  printerIp: string;
  printerName: string;
  branchId: string;
  printerId: string;
  queueLength: number;
  lastPrintedJob: string | null;
  lastError: string | null;
  lastHeartbeat: string;
  startedAt: string;
};

/** Shared runtime state for health dashboard and service readiness. */
export class BridgeState {
  private bridgeRunning = false;
  private realtimeConnected = false;
  private supabaseConnected = false;
  private printerConnected = false;
  private queueLength = 0;
  private lastPrintedJob: string | null = null;
  private lastError: string | null = null;
  private lastHeartbeat = new Date().toISOString();
  readonly startedAt = new Date().toISOString();

  constructor(private readonly config: BridgeConfig) {}

  snapshot(): BridgeHealthSnapshot {
    return {
      version: BRIDGE_VERSION,
      bridgeRunning: this.bridgeRunning,
      realtimeConnected: this.realtimeConnected,
      supabaseConnected: this.supabaseConnected,
      printerConnected: this.printerConnected,
      printerIp: this.config.printerIp,
      printerName: this.config.printerName,
      branchId: this.config.branchId,
      printerId: this.config.printerId,
      queueLength: this.queueLength,
      lastPrintedJob: this.lastPrintedJob,
      lastError: this.lastError,
      lastHeartbeat: this.lastHeartbeat,
      startedAt: this.startedAt,
    };
  }

  setRunning(running: boolean): void {
    this.bridgeRunning = running;
    this.touch();
  }

  setRealtimeConnected(connected: boolean): void {
    this.realtimeConnected = connected;
    this.touch();
  }

  setSupabaseConnected(connected: boolean): void {
    this.supabaseConnected = connected;
    this.touch();
  }

  setPrinterConnected(connected: boolean): void {
    this.printerConnected = connected;
    this.touch();
  }

  setQueueLength(length: number): void {
    this.queueLength = length;
    this.touch();
  }

  setLastPrinted(jobNumber: string): void {
    this.lastPrintedJob = jobNumber;
    this.lastError = null;
    this.touch();
  }

  setLastError(message: string): void {
    this.lastError = message;
    this.touch();
  }

  touch(): void {
    this.lastHeartbeat = new Date().toISOString();
  }
}
