import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(
    `ALTER TYPE "JobStatus" ADD VALUE IF NOT EXISTS 'Deleted'`
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "JobCard" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3)`
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "JobCard" ADD COLUMN IF NOT EXISTS "deletedBy" TEXT`
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "JobCard" ADD COLUMN IF NOT EXISTS "deleteReason" TEXT`
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "JobCard" ADD COLUMN IF NOT EXISTS "createKey" TEXT`
  );
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "JobCard_createKey_key" ON "JobCard"("createKey")`
  );
  console.log("Applied job delete + createKey columns");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
