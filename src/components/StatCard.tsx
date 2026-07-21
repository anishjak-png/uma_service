import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
    <Card className={href ? "transition-colors hover:bg-slate-50" : undefined}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-500">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-2xl font-bold ${valueClassName}`}>{value}</p>
        {subtext && <p className="text-xs text-slate-400">{subtext}</p>}
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }

  return content;
}
