import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import {
  addYearsYmd,
  lastDayOfMonthYmd,
  monthLabel,
  monthStartYmd,
  shopTodayYmd,
  slipComparison,
  yearStartYmd,
  ymdToUtcDate,
  type SlipRangeTotals,
} from "@/lib/slip-service";

async function rangeTotals(fromYmd: string, toYmd: string): Promise<SlipRangeTotals> {
  const result = await prisma.slipServiceValue.aggregate({
    where: {
      date: {
        gte: ymdToUtcDate(fromYmd),
        lte: ymdToUtcDate(toYmd),
      },
    },
    _sum: { amount: true },
    _count: { id: true },
  });
  return {
    amount: result._sum.amount ?? 0,
    days: result._count.id,
  };
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const today = shopTodayYmd();
  const todayLy = addYearsYmd(today, -1);
  const mtdFrom = monthStartYmd(today);
  const mtdFromLy = addYearsYmd(mtdFrom, -1);
  const monthEndLy = lastDayOfMonthYmd(mtdFromLy);
  const ytdFrom = yearStartYmd(today);
  const ytdFromLy = addYearsYmd(ytdFrom, -1);

  const [
    todayTotals,
    todayLyTotals,
    mtd,
    mtdLy,
    thisMonth,
    lastYearMonth,
    ytd,
    ytdLy,
  ] = await Promise.all([
    rangeTotals(today, today),
    rangeTotals(todayLy, todayLy),
    rangeTotals(mtdFrom, today),
    rangeTotals(mtdFromLy, todayLy),
    rangeTotals(mtdFrom, today),
    rangeTotals(mtdFromLy, monthEndLy),
    rangeTotals(ytdFrom, today),
    rangeTotals(ytdFromLy, todayLy),
  ]);

  return NextResponse.json({
    today,
    comparisons: [
      slipComparison("Today", "Today", "Today last year", todayTotals, todayLyTotals),
      slipComparison(
        "MTD",
        "This year MTD",
        "Last year MTD",
        mtd,
        mtdLy
      ),
      slipComparison(
        "This month",
        monthLabel(today),
        monthLabel(mtdFromLy),
        thisMonth,
        lastYearMonth
      ),
      slipComparison("YTD", "This year YTD", "Last year YTD", ytd, ytdLy),
    ],
  });
}
