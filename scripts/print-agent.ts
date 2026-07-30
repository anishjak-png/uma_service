/**
 * Print agent — run on the shop server PC with LAN access to the thermal printer.
 *
 * Required env (via .env or shell):
 *   PRINT_AGENT_APP_URL, PRINT_AGENT_API_KEY, THERMAL_PRINTER_HOST
 *   THERMAL_PRINTER_PORT (default 9100), PRINT_AGENT_POLL_MS (default 2000)
 */

import net from "net";

const APP_URL = process.env.PRINT_AGENT_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const API_KEY = process.env.PRINT_AGENT_API_KEY ?? "";
const PRINTER_HOST = process.env.THERMAL_PRINTER_HOST ?? "";
const PRINTER_PORT = parseInt(process.env.THERMAL_PRINTER_PORT ?? "9100", 10);
const POLL_MS = parseInt(process.env.PRINT_AGENT_POLL_MS ?? "2000", 10);

if (!API_KEY) {
  console.error("PRINT_AGENT_API_KEY is required");
  process.exit(1);
}

if (!PRINTER_HOST) {
  console.error("THERMAL_PRINTER_HOST is required");
  process.exit(1);
}

type QueueJob = {
  id: string;
  jobNumber: string;
  escPosBase64: string;
};

function sendToPrinter(data: Buffer): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const socket = net.createConnection({ host: PRINTER_HOST, port: PRINTER_PORT }, () => {
      socket.write(data, (err) => {
        if (err) {
          socket.destroy();
          reject(err);
          return;
        }
        // Give printer time to print footer + feed before we close TCP.
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
    socket.on("close", () => resolvePromise());
  });
}

async function agentFetch(path: string, init?: RequestInit) {
  return fetch(`${APP_URL.replace(/\/$/, "")}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Print-Agent-Key": API_KEY,
      ...init?.headers,
    },
  });
}

async function updateJobStatus(id: string, status: string, error?: string) {
  await agentFetch(`/api/print-queue/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status, error }),
  });
}

async function processJob(job: QueueJob) {
  console.log(`Printing ${job.jobNumber} (${job.id})…`);

  try {
    const buffer = Buffer.from(job.escPosBase64, "base64");
    await sendToPrinter(buffer);
    await updateJobStatus(job.id, "done");
    console.log(`  Done: ${job.jobNumber}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Print failed";
    console.error(`  Failed: ${job.jobNumber} — ${message}`);
    await updateJobStatus(job.id, "failed", message);
  }
}

let pollInFlight = false;

async function poll() {
  if (pollInFlight) return;
  pollInFlight = true;

  try {
    const res = await agentFetch("/api/print-queue");
    if (!res.ok) {
      console.error(`Poll failed: ${res.status} ${await res.text()}`);
      return;
    }

    const jobs = (await res.json()) as QueueJob[];
    for (const job of jobs) {
      await processJob(job);
    }
  } catch (err) {
    console.error("Poll error:", err instanceof Error ? err.message : err);
  } finally {
    pollInFlight = false;
  }
}

console.log(`Print agent started`);
console.log(`  App:     ${APP_URL}`);
console.log(`  Printer: ${PRINTER_HOST}:${PRINTER_PORT}`);
console.log(`  Poll:    every ${POLL_MS}ms`);

async function main() {
  await poll();
  setInterval(poll, POLL_MS);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
