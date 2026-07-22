/**
 * Measures sync-path DB timings for job creation (no HTTP/auth).
 * Run: npx tsx --env-file=.env scripts/benchmark-job-create.ts
 */
import { prisma } from "../src/lib/db";
import { generateJobNumber } from "../src/lib/jobs";
import { getDefaultTechnicianForAppliance } from "../src/lib/lookups";
import { ensureLookupOption } from "../src/lib/lookups";
import { enqueueReceiptPrint } from "../src/lib/print-queue";

function ms(start: number) {
  return Date.now() - start;
}

async function time<T>(label: string, fn: () => Promise<T>) {
  const start = Date.now();
  const result = await fn();
  console.log(`  ${label}: ${ms(start)}ms`);
  return result;
}

async function simulateLegacySyncPath(applianceType: string, brand: string, complaint: string) {
  console.log("\n--- Legacy sync path (sequential blocking ops) ---");
  const totalStart = Date.now();

  await time("ensureLookupOption x3 (parallel)", () =>
    Promise.all([
      ensureLookupOption("appliance", applianceType),
      ensureLookupOption("brand", brand),
      ensureLookupOption("complaint", complaint),
    ])
  );

  const defaultTech = await time("getDefaultTechnicianForAppliance", () =>
    getDefaultTechnicianForAppliance(applianceType)
  );

  const mobile = `9${String(Date.now()).slice(-9)}`;
  const customer = await time("customer upsert", () =>
    prisma.customer.upsert({
      where: { mobile },
      update: { name: "Bench Customer" },
      create: { mobile, name: "Bench Customer" },
    })
  );

  const jobNumber = await time("generateJobNumber", () => generateJobNumber());

  const job = await time("jobCard.create (+ statusHistory include)", () =>
    prisma.jobCard.create({
      data: {
        jobNumber,
        customerId: customer.id,
        applianceType,
        brand,
        complaint,
        createdBy: "reception",
        assignedTechnicianId: defaultTech?.id ?? null,
        statusHistory: {
          create: { status: "Pending", changedBy: "reception", note: "benchmark" },
        },
      },
      include: { customer: true, assignedTechnician: true, statusHistory: true },
    })
  );

  await time("enqueueReceiptPrint", () => enqueueReceiptPrint(job.id));

  console.log(`  TOTAL (legacy sync, no photos): ${ms(totalStart)}ms`);
  return job.id;
}

async function simulateOptimizedSyncPath(applianceType: string, brand: string, complaint: string) {
  console.log("\n--- Optimized sync path ---");
  const totalStart = Date.now();

  const mobile = `8${String(Date.now()).slice(-9)}`;
  const [customer, jobNumber, defaultTech] = await time(
    "parallel: customer + jobNumber + defaultTech",
    () =>
      Promise.all([
        prisma.customer.upsert({
          where: { mobile },
          update: { name: "Bench Customer" },
          create: { mobile, name: "Bench Customer" },
        }),
        generateJobNumber(),
        getDefaultTechnicianForAppliance(applianceType),
      ])
  );

  const job = await time("jobCard.create (slim include)", () =>
    prisma.jobCard.create({
      data: {
        jobNumber,
        customerId: customer.id,
        applianceType,
        brand,
        complaint,
        createdBy: "reception",
        assignedTechnicianId: defaultTech?.id ?? null,
        statusHistory: {
          create: { status: "Pending", changedBy: "reception", note: "benchmark" },
        },
      },
      include: { customer: true, assignedTechnician: true },
    })
  );

  console.log(`  TOTAL (optimized sync, no photos): ${ms(totalStart)}ms`);
  console.log("  (lookups, receipt queue, photos run in after() — not measured here)");
  return job.id;
}

async function main() {
  const applianceType = "Washing Machine";
  const brand = "Samsung";
  const complaint = "Not working";

  await simulateLegacySyncPath(applianceType, brand, complaint);
  await simulateOptimizedSyncPath(applianceType, brand, complaint);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
