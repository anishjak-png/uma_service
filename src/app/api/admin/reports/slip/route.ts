import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import {
  addDaysYmd,
  addYearsYmd,
  isYmd,
  lastDayOfMonthYmd,
  monthStartYmd,
  shopTodayYmd,
  slipPeriodSeries,
  slipYearBucketLabel,
  SLIP_PRIOR_YEARS,
  yearStartYmd,
  ymdToUtcDate,
  type SlipPeriodSeries,
  type SlipRangeTotals,
  type SlipYearBucket,
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

function yearOffsets(): number[] {
  return Array.from({ length: SLIP_PRIOR_YEARS + 1 }, (_, i) => i);
}

async function yearBuckets(
  fromYmd: string,
  toYmd: string,
  toForPriorYear?: (from: string, to: string) => string
): Promise<SlipYearBucket[]> {
  const offsets = yearOffsets();
  const ranges = offsets.map((yearsAgo) => {
    const from = addYearsYmd(fromYmd, -yearsAgo);
    const shiftedTo = addYearsYmd(toYmd, -yearsAgo);
    const to =
      yearsAgo === 0
        ? toYmd
        : toForPriorYear
          ? toForPriorYear(from, shiftedTo)
          : shiftedTo;
    return { yearsAgo, from, to };
  });

  const totals = await Promise.all(
    ranges.map((range) => rangeTotals(range.from, range.to))
  );

  return ranges.map((range, i) => ({
    yearsAgo: range.yearsAgo,
    label: slipYearBucketLabel(range.from, range.yearsAgo),
    from: range.from,
    to: range.to,
    ...totals[i],
  }));
}

async function periodSeries(
  id: string,
  label: string,
  fromYmd: string,
  toYmd: string,
  toForPriorYear?: (from: string, to: string) => string
): Promise<SlipPeriodSeries> {
  const years = await yearBuckets(fromYmd, toYmd, toForPriorYear);
  return slipPeriodSeries(id, label, years);
}

export async function GET(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const today = shopTodayYmd();
  const yesterday = addDaysYmd(today, -1);
  const mtdFrom = monthStartYmd(today);
  const ytdFrom = yearStartYmd(today);

  const fromParam = request.nextUrl.searchParams.get("from");
  const toParam = request.nextUrl.searchParams.get("to");

  let customRange: SlipPeriodSeries | null = null;
  if (fromParam || toParam) {
    if (!fromParam || !toParam || !isYmd(fromParam) || !isYmd(toParam)) {
      return NextResponse.json({ error: "Valid from and to dates required" }, { status: 400 });
    }
    if (fromParam > toParam) {
      return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
    }
    customRange = await periodSeries(
      "custom",
      `${fromParam} to ${toParam}`,
      fromParam,
      toParam
    );
    return NextResponse.json({ today, customRange });
  }

  const [yesterdaySeries, todaySeries, mtd, thisMonth, ytd] = await Promise.all([
    periodSeries("yesterday", "Yesterday", yesterday, yesterday),
    periodSeries("today", "Today", today, today),
    periodSeries("mtd", "MTD", mtdFrom, today),
    periodSeries("month", "This month", mtdFrom, today, (from) =>
      lastDayOfMonthYmd(from)
    ),
    periodSeries("ytd", "YTD", ytdFrom, today),
  ]);

  return NextResponse.json({
    today,
    comparisons: [yesterdaySeries, todaySeries, mtd, thisMonth, ytd],
  });
}
