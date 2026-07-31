import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'PrintJobStatus' AND e.enumlabel = 'Printed'
      ) THEN
        ALTER TYPE "PrintJobStatus" ADD VALUE 'Printed';
      END IF;
    END $$;
  `);

  await prisma.$executeRawUnsafe(`
    UPDATE "PrintJob" SET status = 'Printed' WHERE status = 'Done';
  `);

  console.log("Migrated PrintJob Done -> Printed");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
