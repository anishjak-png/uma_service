import { appendFileSync, existsSync, mkdirSync, renameSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const MAX_LOG_FILES = 7; // print-bridge.log + .1 … .6

export class BridgeLogger {
  private readonly logPath: string;

  constructor(private readonly logDir: string) {
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true });
    }
    this.rotateIfNeeded();
    this.logPath = join(logDir, "print-bridge.log");
  }

  /** Keep 7 files: current + numbered backups .1 through .6 */
  private rotateIfNeeded(): void {
    const current = join(this.logDir, "print-bridge.log");
    if (!existsSync(current)) return;

    const maxBackup = MAX_LOG_FILES - 1;
    const oldest = join(this.logDir, `print-bridge.${maxBackup}.log`);
    if (existsSync(oldest)) {
      try {
        unlinkSync(oldest);
      } catch {
        // best effort
      }
    }

    for (let i = maxBackup - 1; i >= 1; i--) {
      const from = join(this.logDir, `print-bridge.${i}.log`);
      const to = join(this.logDir, `print-bridge.${i + 1}.log`);
      if (existsSync(from)) {
        try {
          renameSync(from, to);
        } catch {
          // best effort
        }
      }
    }

    try {
      renameSync(current, join(this.logDir, "print-bridge.1.log"));
    } catch {
      // best effort
    }
  }

  private write(level: string, message: string): void {
    const line = `[${new Date().toISOString()}] [${level}] ${message}`;
    console.log(message);
    try {
      appendFileSync(this.logPath, `${line}\n`, "utf8");
    } catch {
      // console-only fallback
    }
  }

  info(message: string): void {
    this.write("INFO", message);
  }

  warn(message: string): void {
    this.write("WARN", message);
  }

  error(message: string): void {
    this.write("ERROR", message);
  }
}

export const log = {
  started: () => "Print Bridge Started",
  realtimeConnected: () => "Realtime Connected",
  realtimeDisconnected: () => "Realtime Disconnected",
  realtimeReconnected: () => "Realtime Reconnected",
  newJob: (id: string) => `New Print Job Received: ${id}`,
  printing: (jobNumber: string) => `Printing Job ${jobNumber}`,
  success: (jobNumber: string) => `Print Successful: ${jobNumber}`,
  failed: (jobNumber: string, error: string) => `Print Failed: ${jobNumber} — ${error}`,
  duplicateIgnored: (id: string) => `Duplicate Event Ignored: ${id}`,
  missedSynced: (count: number) => `Missed Jobs Synced: ${count}`,
  skipped: (id: string, reason: string) => `Job Skipped (${id}): ${reason}`,
};
