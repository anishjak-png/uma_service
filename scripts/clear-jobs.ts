/**
 * Delete all job cards and related records. Keeps customers, technicians,
 * staff, lookups, outsource partners, and notification settings.
 *
 * Usage: npx tsx --env-file=.env scripts/clear-jobs.ts
 * Add --yes to skip confirmation prompt (non-interactive).
 */

import { prisma } from "../src/lib/db";

async function main() {
  const skipConfirm = process.argv.includes("--yes");

  const [jobCount, historyCount, printCount, logCount] = await Promise.all([
    prisma.jobCard.count(),
    prisma.statusHistory.count(),
    prisma.printJob.count(),
    prisma.notificationLog.count(),
  ]);

  console.log("Will delete:");
  console.log(`  Job cards:          ${jobCount}`);
  console.log(`  Status history:     ${historyCount}`);
  console.log(`  Print queue jobs:   ${printCount}`);
  console.log(`  Notification logs:  ${logCount}`);
  console.log("");
  console.log("Keeps: customers, technicians, staff, devices, lookups, partners.");

  if (!skipConfirm && process.stdin.isTTY) {
    console.log("\nRe-run with --yes to confirm.");
    process.exit(1);
  }

  const result = await prisma.$transaction(async (tx) => {
    const deletedLogs = await tx.notificationLog.deleteMany();
    const deletedPrints = await tx.printJob.deleteMany();
    const deletedHistory = await tx.statusHistory.deleteMany();
    const deletedJobs = await tx.jobCard.deleteMany();
    await tx.jobSequence.upsert({
      where: { id: 1 },
      update: { lastNum: 0 },
      create: { id: 1, lastNum: 0 },
    });
    return {
      deletedJobs: deletedJobs.count,
      deletedHistory: deletedHistory.count,
      deletedPrints: deletedPrints.count,
      deletedLogs: deletedLogs.count,
    };
  });

  console.log("\nDone:");
  console.log(`  Removed ${result.deletedJobs} job cards`);
  console.log(`  Removed ${result.deletedHistory} status history rows`);
  console.log(`  Removed ${result.deletedPrints} print jobs`);
  console.log(`  Removed ${result.deletedLogs} notification logs`);
  console.log("  Job number sequence reset to 0 (next job: UT 1)");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
