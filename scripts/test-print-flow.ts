/**
 * End-to-end print test: login as reception, create a job, poll print status.
 * Requires: npm run print-bridge running on shop PC (or local dev + bridge).
 *
 * Usage: npx tsx --env-file=.env scripts/test-print-flow.ts
 */

const APP_URL = process.env.PRINT_AGENT_APP_URL ?? "http://localhost:3000";
const RECEPTION_PIN = process.env.RECEPTION_PIN ?? "1234";

async function main() {
  const loginRes = await fetch(`${APP_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin: RECEPTION_PIN }),
  });
  if (!loginRes.ok) {
    throw new Error(`Login failed: ${loginRes.status} ${await loginRes.text()}`);
  }

  const cookie = loginRes.headers.get("set-cookie");
  if (!cookie) throw new Error("No session cookie from login");

  const form = new FormData();
  form.set("mobile", "9999900001");
  form.set("customerName", "Print Test");
  form.set("applianceType", "Gas Stove");
  form.set("brand", "Others");
  form.set("complaint", "General service");

  const createRes = await fetch(`${APP_URL}/api/jobs`, {
    method: "POST",
    headers: { Cookie: cookie.split(";")[0] },
    body: form,
  });

  if (!createRes.ok) {
    throw new Error(`Create job failed: ${createRes.status} ${await createRes.text()}`);
  }

  const job = (await createRes.json()) as { id: string; jobNumber: string };
  console.log(`Created ${job.jobNumber} (${job.id})`);

  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const printRes = await fetch(`${APP_URL}/api/jobs/${job.id}/print`, {
      headers: { Cookie: cookie.split(";")[0] },
    });
    if (!printRes.ok) continue;
    const status = (await printRes.json()) as { status: string; errorMessage?: string };
    console.log(`  Print status: ${status.status}${status.errorMessage ? ` — ${status.errorMessage}` : ""}`);
    if (status.status === "Printed") {
      console.log("SUCCESS — receipt should have printed on counter printer.");
      return;
    }
    if (status.status === "Failed") {
      throw new Error(`Print failed: ${status.errorMessage ?? "unknown"}`);
    }
  }

  throw new Error("Timed out waiting for print to complete");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
