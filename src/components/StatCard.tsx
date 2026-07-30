import Link from "next/link";

export function StatCard({
  label,
  value,
  subtext,
  href,
  valueClassName = "text-slate-900",
}: {
  label: string;
  value: string | number;
  subtext?: string;
  href?: string;
  valueClassName?: string;
}) {
  const content = (
    <div
      className={`rounded-md border border-slate-200 bg-white px-2.5 py-2 ${
        href ? "transition-colors hover:bg-slate-50" : ""
      }`}
    >
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`text-lg font-bold leading-tight ${valueClassName}`}>
        {value}
      </p>
      {subtext && <p className="text-xs text-slate-400">{subtext}</p>}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block cursor-pointer">
        {content}
      </Link>
    );
  }

  return content;
}
