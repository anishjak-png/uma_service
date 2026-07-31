import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.printJob.updateMany({
    where: { status: { in: ["Pending", "Printing"] } },
    data: { status: "Printed", printedAt: new Date() },
  });
  console.log(`Cleared ${result.count} queued print job(s).`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
