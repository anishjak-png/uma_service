import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [
    received,
    diagnosing,
    inRepair,
    ready,
    whatsappPending,
    deliveredToday,
    overdue,
  ] = await Promise.all([
    prisma.jobCard.count({ where: { status: "Received" } }),
    prisma.jobCard.count({ where: { status: "Diagnosing" } }),
    prisma.jobCard.count({ where: { status: "InRepair" } }),
    prisma.jobCard.count({ where: { status: "Ready" } }),
    prisma.jobCard.count({
      where: { status: "Ready", readyWhatsappSent: false },
    }),
    prisma.jobCard.count({
      where: {
        status: "Delivered",
        deliveredAt: { gte: today, lt: tomorrow },
      },
    }),
    prisma.jobCard.count({
      where: {
        status: { in: ["Received", "Diagnosing", "InRepair"] },
        receivedAt: { lt: sevenDaysAgo },
      },
    }),
  ]);

  const recentReady = await prisma.jobCard.findMany({
    where: { status: "Ready" },
    include: { customer: true },
    orderBy: { readyAt: "desc" },
    take: 10,
  });

  return NextResponse.json({
    counts: {
      received,
      diagnosing,
      inRepair,
      ready,
      whatsappPending,
      deliveredToday,
      overdue,
      active: received + diagnosing + inRepair + ready,
    },
    recentReady,
  });
}
