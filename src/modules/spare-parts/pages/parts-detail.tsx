"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { btnSecondary } from "../components/ui";
import { formatPrice } from "../lib/format";
import type { SparePartWithImages } from "../types";

export default function SparePartDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [part, setPart] = useState<SparePartWithImages | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      const response = await fetch(`/api/spare-parts/parts/${id}`);
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error || "Could not load part");
        return;
      }
      const payload = (await response.json()) as { part: SparePartWithImages };
      setPart(payload.part);
    })();
  }, [id]);

  async function remove() {
    if (!confirm("Delete this spare part?")) return;
    const response = await fetch(`/api/spare-parts/parts/${id}`, { method: "DELETE" });
    if (!response.ok) return;
    router.replace("/spare-parts/parts");
  }

  if (error) return <p className="text-sm text-red-700">{error}</p>;
  if (!part) return <p className="text-sm text-slate-500">Loading…</p>;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold">{part.name}</p>
          <p className="text-sm text-slate-500">{part.code}</p>
        </div>
        <Link href={`/spare-parts/parts/${part.id}/edit`} className="text-sm text-emerald-700">
          Edit
        </Link>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
        <p>Category: {part.category || "—"}</p>
        <p>Brand: {part.brand || "—"}</p>
        <p>Price: {formatPrice(part.selling_price)}</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {part.images.map((image) => (
          <img
            key={image.id}
            src={image.url ?? ""}
            alt=""
            className="aspect-square w-full rounded-lg object-cover"
          />
        ))}
      </div>
      {part.images.length === 0 ? (
        <p className="text-sm text-slate-500">No reference photos yet.</p>
      ) : null}
      <button type="button" className={`${btnSecondary} text-red-700`} onClick={() => void remove()}>
        Delete spare part
      </button>
    </div>
  );
}
