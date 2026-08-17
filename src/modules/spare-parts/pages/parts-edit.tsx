"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PartForm, type PartFormValues } from "../components/PartForm";
import type { SparePartWithImages } from "../types";

export default function SparePartEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [part, setPart] = useState<SparePartWithImages | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const response = await fetch(`/api/spare-parts/parts/${id}`);
    if (!response.ok) return;
    const payload = (await response.json()) as { part: SparePartWithImages };
    setPart(payload.part);
  }

  useEffect(() => {
    void load();
  }, [id]);

  async function onSubmit(values: PartFormValues, images: File[]) {
    setBusy(true);
    setError("");
    const response = await fetch(`/api/spare-parts/parts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: values.name,
        code: values.code,
        category: values.category,
        brand: values.brand,
        selling_price: Number(values.selling_price || 0),
      }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setBusy(false);
      setError(payload?.error || "Could not save");
      return;
    }
    for (const image of images) {
      const form = new FormData();
      form.set("image", image);
      const upload = await fetch(`/api/spare-parts/parts/${id}/images`, { method: "POST", body: form });
      if (!upload.ok) {
        const payload = (await upload.json().catch(() => null)) as { error?: string } | null;
        setBusy(false);
        setError(payload?.error || "Could not upload photo");
        return;
      }
    }
    setBusy(false);
    router.replace(`/spare-parts/parts/${id}`);
  }

  async function onReplaceImage(imageId: string, file: File) {
    const form = new FormData();
    form.set("image", file);
    await fetch(`/api/spare-parts/parts/${id}/images/${imageId}`, { method: "PUT", body: form });
    await load();
  }

  async function onDeleteImage(imageId: string) {
    await fetch(`/api/spare-parts/parts/${id}/images/${imageId}`, { method: "DELETE" });
    await load();
  }

  if (!part) return <p className="text-sm text-slate-500">Loading…</p>;

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-semibold">Edit spare part</h1>
      <PartForm
        initial={{
          name: part.name,
          code: part.code,
          category: part.category,
          brand: part.brand,
          selling_price: String(part.selling_price),
        }}
        existingImages={part.images}
        submitLabel="Save changes"
        busy={busy}
        error={error}
        onSubmit={onSubmit}
        onReplaceImage={onReplaceImage}
        onDeleteImage={onDeleteImage}
      />
    </div>
  );
}
