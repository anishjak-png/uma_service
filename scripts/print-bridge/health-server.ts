import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { BridgeState } from "./bridge-state";
import type { BridgeConfig } from "./config";

function renderHtml(state: ReturnType<BridgeState["snapshot"]>): string {
  const row = (label: string, value: string, ok?: boolean) => {
    const color =
      ok === true ? "#16a34a" : ok === false ? "#dc2626" : "#334155";
    return `<tr><td style="padding:8px 16px;color:#64748b">${label}</td><td style="padding:8px 16px;font-weight:600;color:${color}">${value}</td></tr>`;
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta http-equiv="refresh" content="5"/>
  <title>Uma Print Bridge</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #f8fafc; margin: 0; padding: 24px; }
    .card { max-width: 520px; margin: 0 auto; background: #fff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,.1); overflow: hidden; }
    h1 { margin: 0; padding: 20px 24px; font-size: 1.125rem; background: #0f766e; color: #fff; }
    table { width: 100%; border-collapse: collapse; }
    footer { padding: 12px 24px; font-size: 12px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Print Bridge — Health</h1>
    <table>
      ${row("Bridge Version", state.version)}
      ${row("Bridge Running", state.bridgeRunning ? "Yes" : "No", state.bridgeRunning)}
      ${row("Realtime Connected", state.realtimeConnected ? "Yes" : "No", state.realtimeConnected)}
      ${row("Supabase Connected", state.supabaseConnected ? "Yes" : "No", state.supabaseConnected)}
      ${row("Printer Connected", state.printerConnected ? "Yes" : "No", state.printerConnected)}
      ${row("Printer IP", `${state.printerIp} (${state.printerName})`)}
      ${row("Branch / Printer ID", `${state.branchId} / ${state.printerId}`)}
      ${row("Queue Length", String(state.queueLength))}
      ${row("Last Printed Job", state.lastPrintedJob ?? "—")}
      ${row("Last Error", state.lastError ?? "—", state.lastError ? false : undefined)}
      ${row("Last Heartbeat", state.lastHeartbeat)}
    </table>
    <footer>Auto-refreshes every 5s · <a href="/status">JSON</a></footer>
  </div>
</body>
</html>`;
}

export class HealthServer {
  private server: ReturnType<typeof createServer> | null = null;

  constructor(
    private readonly config: BridgeConfig,
    private readonly state: BridgeState
  ) {}

  start(): void {
    this.server = createServer((req, res) => this.handle(req, res));
    this.server.listen(this.config.healthPort, "127.0.0.1", () => {
      // bound
    });
  }

  stop(): void {
    this.server?.close();
    this.server = null;
  }

  private handle(req: IncomingMessage, res: ServerResponse): void {
    const snapshot = this.state.snapshot();
    const path = req.url?.split("?")[0] ?? "/";

    if (path === "/status" || path === "/api/status") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(snapshot, null, 2));
      return;
    }

    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(renderHtml(snapshot));
  }
}
