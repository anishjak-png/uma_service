"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { btnPrimary, btnSecondary } from "./ui";

export function SparePartsTab() {
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <p className="text-sm text-slate-600">
          Camera spare-parts billing. Admin only. Uses the counter thermal printer.
        </p>
        <Link href="/spare-parts/sales" className={btnPrimary}>
          New sale
        </Link>
        <Link href="/spare-parts/parts" className={btnSecondary}>
          Spare parts catalogue
        </Link>
      </CardContent>
    </Card>
  );
}
