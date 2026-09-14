export const SHOP_TIMEZONE = "Asia/Kolkata";

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export function isYmd(value: string): boolean {
  return YMD.test(value);
}

/** Calendar date in shop timezone (YYYY-MM-DD). */
export function shopTodayYmd(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SHOP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function ymdToUtcDate(ymd: string): Date {
  if (!isYmd(ymd)) {
    throw new Error("Invalid date");
  }
  return new Date(`${ymd}T00:00:00.000Z`);
}

export function utcDateToYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDaysYmd(ymd: string, days: number): string {
  const date = ymdToUtcDate(ymd);
  date.setUTCDate(date.getUTCDate() + days);
  return utcDateToYmd(date);
}

export function addYearsYmd(ymd: string, years: number): string {
  const date = ymdToUtcDate(ymd);
  const day = date.getUTCDate();
  date.setUTCFullYear(date.getUTCFullYear() + years);
  if (date.getUTCDate() !== day) {
    date.setUTCDate(0);
  }
  return utcDateToYmd(date);
}

export function monthStartYmd(ymd: string): string {
  return `${ymd.slice(0, 7)}-01`;
}

export function yearStartYmd(ymd: string): string {
  return `${ymd.slice(0, 4)}-01-01`;
}

export function lastDayOfMonthYmd(ymd: string): string {
  const date = ymdToUtcDate(monthStartYmd(ymd));
  date.setUTCMonth(date.getUTCMonth() + 1, 0);
  return utcDateToYmd(date);
}

export function monthLabel(ymd: string): string {
  const date = ymdToUtcDate(ymd);
  return date.toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatSlipDay(ymd: string): string {
  const date = ymdToUtcDate(ymd);
  return date.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

export type SlipRangeTotals = {
  amount: number;
  days: number;
};

export type SlipComparison = {
  label: string;
  currentLabel: string;
  previousLabel: string;
  current: SlipRangeTotals;
  previous: SlipRangeTotals;
  change: number | null;
};

export function slipComparison(
  label: string,
  currentLabel: string,
  previousLabel: string,
  current: SlipRangeTotals,
  previous: SlipRangeTotals
): SlipComparison {
  return {
    label,
    currentLabel,
    previousLabel,
    current,
    previous,
    change: pctChange(current.amount, previous.amount),
  };
}
