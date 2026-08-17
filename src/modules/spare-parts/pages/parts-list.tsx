"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PartCard } from "../components/PartCard";
import { btnPrimary, inputClass } from "../components/ui";
import type { SparePartWithImages } from "../types";

export default function SparePartsListPage() {
  const [query, setQuery] = useState("");
  const [parts, setParts] = useState<SparePartWithImages[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const handle = setTimeout(() => {
      void (async () => {
        const response = await fetch(`/api/spare-parts/parts?q=${encodeURIComponent(query)}`);
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          setError(payload?.error || "Could not load parts");
          return;
        }
        const payload = (await response.json()) as { parts: SparePartWithImages[] };
        setError("");
        setParts(payload.parts);
      })();
    }, 200);
    return () => clearTimeout(handle);
  }, [query]);

  return (
    <div className="space-y-3">
      <Link href="/spare-parts/parts/new" className={btnPrimary}>
        + Add spare part
      </Link>
      <input
        className={inputClass}
        placeholder="Search parts..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {parts.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">
          No spare parts yet. Add a few with 2–3 photos each.
        </p>
      ) : (
        <div className="space-y-2">
          {parts.map((part) => (
            <PartCard key={part.id} part={part} />
          ))}
        </div>
      )}
    </div>
  );
}
