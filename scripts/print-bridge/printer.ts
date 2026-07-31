import net from "net";
import type { BridgeConfig } from "./config";

export class LanPrinter {
  constructor(private readonly config: BridgeConfig) {}

  async print(data: Buffer): Promise<void> {
    const { printerHost, printerPort } = this.config;

    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host: printerHost, port: printerPort }, () => {
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
