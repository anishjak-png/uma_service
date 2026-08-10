import type { DeliveryContactStatus } from "@prisma/client";

export type DeliveryCallOutcome = "coming_in" | "no_answer" | "not_reachable";

export function formatExpectedDeliveryDate(
  date: Date | string | null | undefined
): string | null {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function addCalendarDays(from: Date, days: number): Date {
  const result = new Date(from);
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() + days);
  return result;
}

export function buildDeliveryCallHistoryNote(
  outcome: DeliveryCallOutcome,
  expectedDeliveryAt?: Date | null
): string {
  switch (outcome) {
    case "coming_in": {
      const when = expectedDeliveryAt
        ? formatExpectedDeliveryDate(expectedDeliveryAt)
        : null;
      return when
        ? `Delivery call — Customer coming in (expected ${when})`
        : "Delivery call — Customer coming in";
    }
    case "no_answer":
      return "Delivery call — No answer";
    case "not_reachable":
      return "Delivery call — Not reachable";
  }
}

export function contactStatusLabel(status: DeliveryContactStatus): string {
  return status === "contacted" ? "Contacted" : "Not contacted";
}

export function shouldShowDeliveryContact(
  jobStatus: string
): boolean {
  return jobStatus === "Ready" || jobStatus === "Return";
}
