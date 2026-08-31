export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return `Rs.${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

/** True only when Ready/edit actually stored a bill split (not legacy total-only jobs). */
export function hasStoredBillSplit(job: {
  serviceCharge?: number | null;
  sparesAmount?: number | null;
}): boolean {
  return job.serviceCharge != null || job.sparesAmount != null;
}

/**
 * Stored bill parts. Legacy jobs (both split fields null) have hasSplit=false —
 * do not invent Service/Spares from the total.
 */
export function resolveStoredBillSplit(job: {
  serviceAmount?: number | null;
  serviceCharge?: number | null;
  sparesAmount?: number | null;
}): {
  serviceCharge: number;
  sparesAmount: number;
  serviceAmount: number;
  hasSplit: boolean;
} {
  const serviceAmount = job.serviceAmount ?? 0;
  if (hasStoredBillSplit(job)) {
    return {
      serviceCharge: job.serviceCharge ?? 0,
      sparesAmount: job.sparesAmount ?? 0,
      serviceAmount,
      hasSplit: true,
    };
  }
  return {
    serviceCharge: 0,
    sparesAmount: 0,
    serviceAmount,
    hasSplit: false,
  };
}

/** Admin-facing split line, or null for legacy total-only jobs. */
export function formatBillSplitLine(job: {
  serviceAmount?: number | null;
  serviceCharge?: number | null;
  sparesAmount?: number | null;
}): string | null {
  if (!hasStoredBillSplit(job)) return null;
  const { serviceCharge, sparesAmount } = resolveStoredBillSplit(job);
  return `Service ${formatCurrency(serviceCharge)} · Spares ${formatCurrency(sparesAmount)}`;
}

export function sumBillSplits(
  jobs: Array<{
    serviceAmount?: number | null;
    serviceCharge?: number | null;
    sparesAmount?: number | null;
  }>
): {
  totalCollection: number;
  serviceChargeTotal: number;
  sparesAmountTotal: number;
  splitJobCount: number;
} {
  return jobs.reduce(
    (acc, job) => {
      const split = resolveStoredBillSplit(job);
      return {
        totalCollection: acc.totalCollection + split.serviceAmount,
        serviceChargeTotal:
          acc.serviceChargeTotal + (split.hasSplit ? split.serviceCharge : 0),
        sparesAmountTotal:
          acc.sparesAmountTotal + (split.hasSplit ? split.sparesAmount : 0),
        splitJobCount: acc.splitJobCount + (split.hasSplit ? 1 : 0),
      };
    },
    {
      totalCollection: 0,
      serviceChargeTotal: 0,
      sparesAmountTotal: 0,
      splitJobCount: 0,
    }
  );
}

/** Parse a non-negative amount. Empty/null → null (caller may treat as 0). */
export function parseServiceAmount(value: unknown): number | null {
  if (value == null || value === "") return null;
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num) || num < 0) return null;
  return num;
}

/**
 * Resolve serviceCharge + sparesAmount (+ optional legacy serviceAmount).
 * Blank parts default to 0. Returns null only if a provided value is invalid/negative.
 */
export function resolveBillSplit(body: {
  serviceCharge?: unknown;
  sparesAmount?: unknown;
  serviceAmount?: unknown;
}): { serviceCharge: number; sparesAmount: number; serviceAmount: number } | null {
  const hasSplit =
    body.serviceCharge !== undefined || body.sparesAmount !== undefined;

  if (hasSplit) {
    const serviceCharge =
      body.serviceCharge === undefined || body.serviceCharge === ""
        ? 0
        : parseServiceAmount(body.serviceCharge);
    const sparesAmount =
      body.sparesAmount === undefined || body.sparesAmount === ""
        ? 0
        : parseServiceAmount(body.sparesAmount);
    if (serviceCharge == null || sparesAmount == null) return null;
    return {
      serviceCharge,
      sparesAmount,
      serviceAmount: serviceCharge + sparesAmount,
    };
  }

  if (body.serviceAmount !== undefined) {
    const amount =
      body.serviceAmount === "" ? 0 : parseServiceAmount(body.serviceAmount);
    if (amount == null) return null;
    // Legacy single-amount clients: store total only — do not invent a split.
    return { serviceCharge: amount, sparesAmount: 0, serviceAmount: amount };
  }

  return null;
}
