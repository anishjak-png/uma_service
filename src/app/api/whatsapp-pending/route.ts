import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const jobs = await prisma.jobCard.findMany({
    where: { status: "Ready", readyWhatsappSent: false },
    include: { customer: true },
    orderBy: { readyAt: "asc" },
  });

  return NextResponse.json(jobs);
}
