export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return `Rs.${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export function parseServiceAmount(value: unknown): number | null {
  if (value == null || value === "") return null;
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num) || num < 0) return null;
  return num;
}
