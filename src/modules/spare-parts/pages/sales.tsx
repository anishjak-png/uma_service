"use client";

import { useState } from "react";
import { CameraCapture } from "../components/CameraCapture";
import { SaleReceipt, type ClosedSale } from "../components/SaleReceipt";
import { btnPrimary, btnSecondary } from "../components/ui";
import { formatPrice, toPercent } from "../lib/format";
import type { MatchCandidate, MatchResult, SparePartWithImages } from "../types";

type BillLine = {
  spare_part_id: string;
  name: string;
  code: string;
  unit_price: number;
  qty: number;
};

export default function SparePartsSalesPage() {
  const [lines, setLines] = useState<BillLine[]>([]);
  const [choices, setChoices] = useState<MatchCandidate[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [cameraKey, setCameraKey] = useState(0);
  const [closed, setClosed] = useState<ClosedSale | null>(null);

  const total = lines.reduce((sum, line) => sum + line.unit_price * line.qty, 0);

  function addPart(part: SparePartWithImages) {
    setLines((current) => {
      const existing = current.find((line) => line.spare_part_id === part.id);
      if (existing) {
        return current.map((line) =>
          line.spare_part_id === part.id ? { ...line, qty: line.qty + 1 } : line,
        );
      }
      return [
        ...current,
        {
          spare_part_id: part.id,
          name: part.name,
          code: part.code,
          unit_price: Number(part.selling_price) || 0,
          qty: 1,
        },
      ];
    });
    setChoices(null);
    setNotice(`Added ${part.name}`);
    setCameraKey((value) => value + 1);
  }

  async function onPhoto(file: File) {
    setBusy(true);
    setError("");
    setNotice("");
    setChoices(null);
    try {
      const form = new FormData();
      form.set("image", file);
      form.set("reference_limit", "3");
      const response = await fetch("/api/spare-parts/identify", { method: "POST", body: form });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error || "Could not identify part");
        return;
      }
      const result = (await response.json()) as MatchResult;
      if (result.confident && result.product) {
        addPart(result.product);
        return;
      }
      if (result.candidates.length > 0) {
        setChoices(result.candidates);
        return;
      }
      setError("No match. Take another photo.");
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function closeBill() {
    if (lines.length === 0 || busy || saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/spare-parts/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: lines }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        sale?: ClosedSale;
        printJobId?: string;
      } | null;
      if (!response.ok || !payload?.sale) {
        setError(payload?.error || "Could not close bill");
        return;
      }
      setClosed({
        ...payload.sale,
        printJobId: payload.printJobId ?? payload.sale.printJobId,
        items: payload.sale.items?.length
          ? payload.sale.items
          : lines.map((line) => ({
              name: line.name,
              code: line.code,
              qty: line.qty,
              unit_price: line.unit_price,
              line_total: line.unit_price * line.qty,
            })),
      });
      setLines([]);
      setChoices(null);
    } catch {
      setError("Could not close bill");
    } finally {
      setSaving(false);
    }
  }

  if (closed) {
    return (
      <SaleReceipt
        sale={closed}
        autoPoll
        onNewBill={() => {
          setClosed(null);
          setNotice("");
          setCameraKey((value) => value + 1);
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {choices ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold">Tap to add</p>
          {choices.map((candidate, index) => {
            const part = candidate.product;
            const thumb = part.images[0]?.url;
            return (
              <button
                key={part.id}
                type="button"
                className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left"
                onClick={() => addPart(part)}
              >
                <span className="w-5 text-sm font-semibold text-slate-500">{index + 1}</span>
                <div className="h-12 w-12 overflow-hidden rounded-md bg-slate-100">
                  {thumb ? <img src={thumb} alt="" className="h-full w-full object-cover" /> : null}
                </div>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{part.name}</span>
                  <span className="block text-xs text-slate-500">
                    {part.code} · {formatPrice(part.selling_price)}
                  </span>
                </span>
                <span className="text-sm font-semibold">{toPercent(candidate.similarity)}</span>
              </button>
            );
          })}
          <button
            type="button"
            className={btnSecondary}
            onClick={() => {
              setChoices(null);
              setCameraKey((value) => value + 1);
            }}
          >
            Retake photo
          </button>
        </div>
      ) : (
        <>
          <CameraCapture
            key={cameraKey}
            autoSubmit
            busy={busy}
            onConfirm={onPhoto}
            confirmLabel="Add to bill"
          />
          {busy ? <p className="text-center text-sm text-slate-500">Matching…</p> : null}
        </>
      )}
      {notice ? <p className="text-center text-sm font-medium text-emerald-700">{notice}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <section className="rounded-lg border border-slate-200 bg-white p-3">
        {lines.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">Bill is empty. Take a photo to add a part.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {lines.map((line) => (
              <li key={line.spare_part_id} className="flex items-center gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{line.name}</p>
                  <p className="text-xs text-slate-500">{formatPrice(line.unit_price)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="h-8 w-8 rounded-md border border-slate-300"
                    onClick={() =>
                      setLines((current) =>
                        current.flatMap((item) => {
                          if (item.spare_part_id !== line.spare_part_id) return [item];
                          if (item.qty <= 1) return [];
                          return [{ ...item, qty: item.qty - 1 }];
                        }),
                      )
                    }
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-sm font-semibold">{line.qty}</span>
                  <button
                    type="button"
                    className="h-8 w-8 rounded-md border border-slate-300"
                    onClick={() =>
                      setLines((current) =>
                        current.map((item) =>
                          item.spare_part_id === line.spare_part_id
                            ? { ...item, qty: item.qty + 1 }
                            : item,
                        ),
                      )
                    }
                  >
                    +
                  </button>
                </div>
                <p className="w-16 text-right text-sm font-semibold">
                  {formatPrice(line.unit_price * line.qty)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="sticky bottom-0 space-y-2 bg-slate-50 pb-2 pt-1">
        <div className="flex items-center justify-between px-1 text-lg font-semibold">
          <span>Total</span>
          <span>{formatPrice(total)}</span>
        </div>
        <button
          type="button"
          className={btnPrimary}
          disabled={lines.length === 0 || busy || saving}
          onClick={() => void closeBill()}
        >
          {saving ? "Saving…" : "Close bill"}
        </button>
      </div>
    </div>
  );
}
