"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PartForm, type PartFormValues } from "../components/PartForm";

export default function SparePartsNewPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(values: PartFormValues, images: File[]) {
    setBusy(true);
    setError("");
    const form = new FormData();
    form.set("name", values.name);
    form.set("code", values.code);
    form.set("category", values.category);
    form.set("brand", values.brand);
    form.set("selling_price", values.selling_price);
    for (const image of images) form.append("images", image);
    const response = await fetch("/api/spare-parts/parts", { method: "POST", body: form });
    setBusy(false);
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error || "Could not save spare part");
      return;
    }
    const payload = (await response.json()) as { part: { id: string } };
    router.replace(`/spare-parts/parts/${payload.part.id}`);
  }

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-semibold">Add spare part</h1>
      <PartForm submitLabel="Save spare part" busy={busy} error={error} onSubmit={onSubmit} />
    </div>
  );
}
