import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'PrintJob'
      ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE "PrintJob";
      END IF;
    END $$;
  `);
  console.log("PrintJob added to supabase_realtime publication");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
