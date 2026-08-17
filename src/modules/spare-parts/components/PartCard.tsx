import Link from "next/link";
import { formatPrice } from "../lib/format";
import type { SparePartWithImages } from "../types";

export function PartCard({ part }: { part: SparePartWithImages }) {
  const thumb = part.images[0]?.url;
  return (
    <Link
      href={`/spare-parts/parts/${part.id}`}
      className="flex gap-3 rounded-lg border border-slate-200 bg-white p-3"
    >
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-slate-100">
        {thumb ? (
          <img src={thumb} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-[10px] text-slate-400">
            No photo
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900">{part.name}</p>
        <p className="text-xs text-slate-500">{part.code}</p>
        <p className="mt-1 text-sm font-medium text-slate-800">{formatPrice(part.selling_price)}</p>
      </div>
    </Link>
  );
}
