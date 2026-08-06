export type ReportPeriod = "today" | "week" | "month" | "year";

const REPORT_PERIODS: ReportPeriod[] = ["today", "week", "month", "year"];

export function isReportPeriod(value: string): value is ReportPeriod {
  return REPORT_PERIODS.includes(value as ReportPeriod);
}

export function getPeriodRange(period: ReportPeriod) {
  const now = new Date();
  const start = new Date(now);

  if (period === "today") {
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
  }

  if (period === "week") {
    // Week starting Monday 00:00 through start of tomorrow (week-to-date).
    start.setHours(0, 0, 0, 0);
    const day = start.getDay(); // 0 Sun … 6 Sat
    const daysFromMonday = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - daysFromMonday);
    const end = new Date(now);
    end.setHours(0, 0, 0, 0);
    end.setDate(end.getDate() + 1);
    return { start, end };
  }

  if (period === "month") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    return { start, end };
  }

  start.setMonth(0, 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getFullYear() + 1, 0, 1);
  return { start, end };
}

export function daysAgo(days: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date;
}

export function periodLabel(period: ReportPeriod): string {
  switch (period) {
    case "today":
      return "Today";
    case "week":
      return "This week";
    case "month":
      return "This month";
    case "year":
      return "This year";
  }
}

/**
 * Given status history newest-first, return the status immediately before
 * Delivered (skipping leading Delivered rows). Used to classify return closures.
 */
export function previousStatusBeforeDelivered(
  historyDesc: Array<{ status: string }>
): string | null {
  let i = 0;
  while (i < historyDesc.length && historyDesc[i].status === "Delivered") {
    i += 1;
  }
  return historyDesc[i]?.status ?? null;
}

export function wasDeliveredFromReturn(
  historyDesc: Array<{ status: string }>
): boolean {
  return previousStatusBeforeDelivered(historyDesc) === "Return";
}
