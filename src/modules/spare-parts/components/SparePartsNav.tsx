"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/spare-parts/sales", label: "Sales" },
  { href: "/spare-parts/parts", label: "Parts" },
];

export function SparePartsNav() {
  const pathname = usePathname();
  return (
    <div className="mb-3 flex gap-1 rounded-md border border-slate-200 bg-white p-0.5">
      {LINKS.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`flex-1 rounded px-2 py-2 text-center text-xs font-medium ${
              active ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}
