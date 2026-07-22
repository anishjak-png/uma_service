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

  const receivedWhere = range
    ? { receivedAt: { gte: range.start, lt: range.end } }
    : {};

  const deliveredWhere = {
    status: "Delivered" as const,
    ...(range ? { deliveredAt: { gte: range.start, lt: range.end } } : {}),
  };

  const [received, pending, ready, delivered] = await Promise.all([
    prisma.jobCard.count({ where: receivedWhere }),
    prisma.jobCard.count({ where: { status: "Pending" } }),
    prisma.jobCard.count({ where: { status: "Ready" } }),
    prisma.jobCard.count({ where: deliveredWhere }),
  ]);

  return NextResponse.json({
    period,
    received: { count: received },
    pending: { count: pending },
    ready: { count: ready },
    delivered: { count: delivered },
  });
}
