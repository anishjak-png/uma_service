import { JobStatus, PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function prismaHasWarrantySupport(): boolean {
  return Boolean(
    JobStatus.WarrantyPending &&
      JobStatus.WarrantyWithCompany &&
      Object.values(JobStatus).includes(JobStatus.WarrantyPending)
  );
}

if (process.env.NODE_ENV !== "production" && globalForPrisma.prisma) {
  if (!prismaHasWarrantySupport()) {
    void globalForPrisma.prisma.$disconnect().catch(() => {});
    globalForPrisma.prisma = undefined;
    console.warn(
      "[prisma] Stale client detected — stop dev server, run `npx prisma generate`, delete `.next`, restart."
    );
  }
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
