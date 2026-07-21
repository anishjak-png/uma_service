import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

type Period = "today" | "month" | "all";

function dateRange(period: Period) {
  if (period === "all") return null;

  const now = new Date();
  if (period === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
  }

  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start, end };
}

export async function GET(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const period = (request.nextUrl.searchParams.get("period") ?? "month") as Period;
  const range = dateRange(period);

  const readyWhere = {
    status: "Ready" as const,
    finalCost: { not: null },
    ...(range
      ? { readyAt: { gte: range.start, lt: range.end } }
      : {}),
  };

  const deliveredWhere = {
    status: "Delivered" as const,
    finalCost: { not: null },
    ...(range
      ? { deliveredAt: { gte: range.start, lt: range.end } }
      : {}),
  };

  const [pending, delivered] = await Promise.all([
    prisma.jobCard.aggregate({
      where: readyWhere,
      _sum: { finalCost: true },
      _count: true,
    }),
    prisma.jobCard.aggregate({
      where: deliveredWhere,
      _sum: { finalCost: true },
      _count: true,
    }),
  ]);

  const pendingTotal = pending._sum.finalCost ?? 0;
  const deliveredTotal = delivered._sum.finalCost ?? 0;

  return NextResponse.json({
    period,
    pending: { count: pending._count, total: pendingTotal },
    delivered: { count: delivered._count, total: deliveredTotal },
    serviced: {
      count: pending._count + delivered._count,
      total: pendingTotal + deliveredTotal,
    },
  });
}
