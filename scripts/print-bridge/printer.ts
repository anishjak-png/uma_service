import net from "node:net";
import type { BridgeConfig } from "./config";

const PRINT_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

export class LanPrinter {
  constructor(private readonly config: BridgeConfig) {}

  get label(): string {
    return `${this.config.printerName} (${this.config.printerIp}:${this.config.printerPort})`;
  }

  async ping(timeoutMs = 4000): Promise<boolean> {
    const { printerIp, printerPort } = this.config;

    return new Promise((resolve) => {
      const socket = net.createConnection({ host: printerIp, port: printerPort });
      let settled = false;

      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        resolve(ok);
      };

      socket.setTimeout(timeoutMs);
      socket.once("connect", () => finish(true));
      socket.once("timeout", () => finish(false));
      socket.once("error", () => finish(false));
    });
  }

  async print(data: Buffer): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= PRINT_RETRIES; attempt++) {
      try {
        await this.printOnce(data);
        return;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error("Print failed");
        if (attempt < PRINT_RETRIES) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
        }
      }
    }

    throw lastError ?? new Error("Print failed");
  }

  private printOnce(data: Buffer): Promise<void> {
    const { printerIp, printerPort } = this.config;

    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host: printerIp, port: printerPort }, () => {
        socket.write(data, (err) => {
          if (err) {
            socket.destroy();
            reject(err);
            return;
          }
          const drainMs = Math.max(2000, Math.ceil(data.length / 40));
          setTimeout(() => socket.end(), drainMs);
        });
      });

      socket.setTimeout(20000);
      socket.on("timeout", () => {
        socket.destroy();
        reject(new Error("Printer connection timed out"));
      });
      socket.on("error", reject);
      socket.on("close", () => resolve());
    });
  }
}
