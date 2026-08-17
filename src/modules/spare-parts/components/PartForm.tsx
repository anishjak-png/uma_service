"use client";

import { useState } from "react";
import { MAX_REFERENCE_IMAGES } from "../constants";
import { resizeImageFile } from "../lib/format";
import type { SparePartImage } from "../types";
import { btnPrimary, btnSecondary, inputClass } from "./ui";

export type PartFormValues = {
  name: string;
  code: string;
  category: string;
  brand: string;
  selling_price: string;
};

type Props = {
  initial?: PartFormValues;
  existingImages?: SparePartImage[];
  submitLabel: string;
  busy?: boolean;
  error?: string;
  onSubmit: (values: PartFormValues, newImages: File[]) => void | Promise<void>;
  onReplaceImage?: (imageId: string, file: File) => void | Promise<void>;
  onDeleteImage?: (imageId: string) => void | Promise<void>;
};

const empty: PartFormValues = {
  name: "",
  code: "",
  category: "",
  brand: "",
  selling_price: "",
};

export function PartForm({
  initial,
  existingImages = [],
  submitLabel,
  busy,
  error,
  onSubmit,
  onReplaceImage,
  onDeleteImage,
}: Props) {
  const [values, setValues] = useState<PartFormValues>(initial ?? empty);
  const [newPreviews, setNewPreviews] = useState<{ file: File; url: string }[]>([]);
  const [localError, setLocalError] = useState("");

  const totalPhotos = existingImages.length + newPreviews.length;

  function field<K extends keyof PartFormValues>(key: K) {
    return {
      value: values[key],
      onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
        setValues((current) => ({ ...current, [key]: event.target.value })),
    };
  }

  async function addFiles(list: FileList | null) {
    if (!list) return;
    const room = MAX_REFERENCE_IMAGES - existingImages.length - newPreviews.length;
    const next: { file: File; url: string }[] = [];
    try {
      for (const file of Array.from(list).slice(0, room)) {
        const resized = await resizeImageFile(file);
        const packed = new File([resized], "part.jpg", { type: "image/jpeg" });
        next.push({ file: packed, url: URL.createObjectURL(packed) });
      }
      setLocalError("");
      setNewPreviews((current) => [...current, ...next]);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Could not read this photo");
    }
  }

  async function replaceExisting(imageId: string, file: File | undefined) {
    if (!file || !onReplaceImage) return;
    try {
      const resized = await resizeImageFile(file);
      await onReplaceImage(imageId, new File([resized], "part.jpg", { type: "image/jpeg" }));
      setLocalError("");
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Could not replace photo");
    }
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(
          values,
          newPreviews.map((item) => item.file),
        );
      }}
    >
      <label className="block text-xs font-medium text-slate-600">
        Product name
        <input required className={inputClass} {...field("name")} />
      </label>
      <label className="block text-xs font-medium text-slate-600">
        Product code
        <input required className={inputClass} {...field("code")} />
      </label>
      <label className="block text-xs font-medium text-slate-600">
        Category
        <input className={inputClass} {...field("category")} />
      </label>
      <label className="block text-xs font-medium text-slate-600">
        Brand
        <input className={inputClass} {...field("brand")} />
      </label>
      <label className="block text-xs font-medium text-slate-600">
        Selling price
        <input className={inputClass} inputMode="decimal" {...field("selling_price")} />
      </label>

      <div>
        <p className="mb-1 text-xs font-medium text-slate-600">Reference images</p>
        <p className="mb-2 text-xs text-slate-500">Fill the frame. Add 2–3 angles if you can.</p>
        <div className="grid grid-cols-3 gap-2">
          {existingImages.map((image) => (
            <div key={image.id} className="overflow-hidden rounded-lg bg-slate-100">
              {image.url ? (
                <img src={image.url} alt="" className="aspect-square w-full object-cover" />
              ) : (
                <div className="aspect-square" />
              )}
              <div className="flex">
                {onReplaceImage ? (
                  <label className="flex-1 py-1 text-center text-[10px] text-slate-600">
                    Replace
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="sr-only"
                      onChange={(event) => {
                        void replaceExisting(image.id, event.target.files?.[0]);
                        event.target.value = "";
                      }}
                    />
                  </label>
                ) : null}
                {onDeleteImage ? (
                  <button
                    type="button"
                    className="flex-1 py-1 text-[10px] text-red-700"
                    onClick={() => void onDeleteImage(image.id)}
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            </div>
          ))}
          {newPreviews.map((item, index) => (
            <div key={item.url} className="overflow-hidden rounded-lg bg-slate-100">
              <img src={item.url} alt="" className="aspect-square w-full object-cover" />
              <button
                type="button"
                className="w-full py-1 text-[10px] text-red-700"
                onClick={() => setNewPreviews((current) => current.filter((_, i) => i !== index))}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        {totalPhotos < MAX_REFERENCE_IMAGES ? (
          <label className={`${btnSecondary} mt-2`}>
            {totalPhotos === 0 ? "+ Add photo" : "+ Add another photo"}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(event) => {
                void addFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </label>
        ) : null}
      </div>

      {localError || error ? <p className="text-sm text-red-700">{localError || error}</p> : null}
      <button type="submit" className={btnPrimary} disabled={busy}>
        {busy ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
