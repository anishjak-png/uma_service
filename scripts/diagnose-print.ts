import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";

function normalizeUrl(raw: string) {
  return raw.replace(/\/rest\/v1\/?$/i, "").replace(/\/+$/, "");
}

async function main() {
  const prisma = new PrismaClient();
  const url = normalizeUrl(process.env.SUPABASE_URL ?? "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  console.log("=== Prisma: recent PrintJobs ===");
  const jobs = await prisma.printJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      status: true,
      branchId: true,
      printerId: true,
      createdAt: true,
      errorMessage: true,
    },
  });
  console.log(jobs.length ? jobs : "(none)");

  const cols = await prisma.$queryRaw<{ column_name: string }[]>`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'PrintJob' ORDER BY 1`;
  console.log("PrintJob columns:", cols.map((c) => c.column_name).join(", "));

  const enums = await prisma.$queryRaw<{ enumlabel: string }[]>`
    SELECT e.enumlabel FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'PrintJobStatus'`;
  console.log("PrintJobStatus enum:", enums.map((e) => e.enumlabel).join(", "));

  const pub = await prisma.$queryRaw<
    { tablename: string }[]
  >`SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'PrintJob'`;
  console.log(pub.length ? "PrintJob is in supabase_realtime" : "PrintJob NOT in supabase_realtime");

  if (url && key) {
    console.log("\n=== Supabase REST: pending for main/counter-1 ===");
    const sb = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await sb
      .from("PrintJob")
      .select("id, status, branchId, printerId, createdAt")
      .eq("status", "Pending")
      .eq("branchId", "main")
      .eq("printerId", "counter-1")
      .order("createdAt", { ascending: false })
      .limit(5);
    if (error) console.log("REST error:", error.message);
    else console.log(data?.length ? data : "(none pending)");
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
