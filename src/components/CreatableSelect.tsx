"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

type LookupCategory = "appliance" | "brand" | "complaint";

interface CreatableSelectProps {
  category: LookupCategory;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
  /** Links new brand/complaint values to a product type when adding from job form. */
  applianceType?: string;
  onSelect?: (value: string) => void;
  /** When provided, skips the per-category lookup fetch. */
  options?: string[];
  onOptionsChange?: (category: LookupCategory, options: string[]) => void;
}

function useIsMobilePicker() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 640px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return isMobile;
}

export function CreatableSelect({
  category,
  label,
  value,
  onChange,
  required,
  placeholder = "Select or add new",
  disabled = false,
  applianceType,
  onSelect,
  options: externalOptions,
  onOptionsChange,
}: CreatableSelectProps) {
  const [internalOptions, setInternalOptions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobilePicker();

  const options = externalOptions ?? internalOptions;

  const loadOptions = useCallback(async () => {
    const res = await fetch(`/api/lookups?category=${category}`);
    const data = await res.json();
    const values = data.map((o: { value: string }) => o.value);
    setInternalOptions(values);
    return values;
  }, [category]);

  useEffect(() => {
    if (externalOptions != null) return;
    loadOptions();
  }, [externalOptions, loadOptions]);

  useEffect(() => {
    if (!open || isMobile) return;

    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, isMobile]);

  useEffect(() => {
    if (!open || !isMobile) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open, isMobile]);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      containerRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }, [open]);

  useEffect(() => {
    if (!open || isMobile) return;
    searchRef.current?.focus();
  }, [open, isMobile]);

  function closePicker() {
    setOpen(false);
    setSearch("");
  }

  function openPicker() {
    if (disabled) return;
    setOpen(true);
  }

  async function addOption(newValue: string) {
    const trimmed = newValue.trim();
    if (!trimmed) return;

    await fetch("/api/lookups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category,
        value: trimmed,
        applianceType:
          applianceType && (category === "brand" || category === "complaint")
            ? applianceType
            : undefined,
      }),
    });

    if (onOptionsChange) {
      const next = [...options, trimmed].sort((a, b) => a.localeCompare(b));
      onOptionsChange(category, next);
    } else {
      await loadOptions();
    }

    onChange(trimmed);
    onSelect?.(trimmed);
    closePicker();
  }

  function selectOption(option: string) {
    onChange(option);
    onSelect?.(option);
    closePicker();
  }

  const filtered = options.filter((o) =>
    o.toLowerCase().includes(search.toLowerCase())
  );
  const trimmedSearch = search.trim();
  const canAdd =
    trimmedSearch.length > 0 &&
    !options.some((o) => o.toLowerCase() === trimmedSearch.toLowerCase());

  const panelContent = (
    <div className="flex min-h-0 flex-1 flex-col sm:block">
      <div className="border-b border-slate-100 p-2">
        <input
          ref={searchRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search or type new..."
          className="flex h-10 w-full rounded-md border border-slate-300 px-3 py-2 text-base placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          onKeyDown={(e) => {
            if (e.key === "Enter" && canAdd) {
              e.preventDefault();
              addOption(trimmedSearch);
            }
          }}
        />
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1 sm:max-h-52 sm:flex-none">
        {canAdd && (
          <li>
            <button
              type="button"
              onClick={() => addOption(trimmedSearch)}
              className="w-full px-4 py-3 text-left text-sm font-medium text-emerald-600 hover:bg-emerald-50"
            >
              + Add &quot;{trimmedSearch}&quot;
            </button>
          </li>
        )}

        {filtered.map((option) => (
          <li key={option}>
            <button
              type="button"
              onClick={() => selectOption(option)}
              className={`w-full px-4 py-3 text-left text-sm hover:bg-slate-50 ${
                option === value
                  ? "bg-emerald-50 font-semibold text-emerald-700"
                  : "text-slate-800"
              }`}
            >
              {option}
            </button>
          </li>
        ))}

        {filtered.length === 0 && !canAdd && (
          <li className="px-4 py-3 text-sm text-slate-400">No options found</li>
        )}
      </ul>
    </div>
  );

  let picker: ReactNode = null;
  if (open && !disabled) {
    if (isMobile) {
      picker = (
        <>
          <button
            type="button"
            aria-label="Close picker"
            className="fixed inset-0 z-[100] bg-black/40"
            onClick={closePicker}
          />
          <div className="fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[101] flex max-h-[min(78dvh,28rem)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-3 py-2.5">
              <span className="text-sm font-semibold text-slate-900">{label}</span>
              <button
                type="button"
                onClick={closePicker}
                className="rounded-md px-2 py-1 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
              >
                Done
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{panelContent}</div>
          </div>
        </>
      );
    } else {
      picker = (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {panelContent}
        </div>
      );
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <label className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {required && " *"}
      </label>

      <button
        type="button"
        disabled={disabled}
        onClick={() => (open ? closePicker() : openPicker())}
        className="flex h-10 w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
      >
        <span className={value ? "text-slate-900" : "text-slate-400"}>
          {value || placeholder}
        </span>
        <span className="text-slate-400">▾</span>
      </button>

      {picker}
    </div>
  );
}
