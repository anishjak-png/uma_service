"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type LookupCategory = "appliance" | "brand" | "complaint";

interface CreatableSelectProps {
  category: LookupCategory;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  onSelect?: (value: string) => void;
  /** When provided, skips the per-category lookup fetch. */
  options?: string[];
  onOptionsChange?: (category: LookupCategory, options: string[]) => void;
}

export function CreatableSelect({
  category,
  label,
  value,
  onChange,
  required,
  placeholder = "Select or add new",
  onSelect,
  options: externalOptions,
  onOptionsChange,
}: CreatableSelectProps) {
  const [internalOptions, setInternalOptions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

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
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function addOption(newValue: string) {
    const trimmed = newValue.trim();
    if (!trimmed) return;

    await fetch("/api/lookups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, value: trimmed }),
    });

    if (onOptionsChange) {
      const next = [...options, trimmed].sort((a, b) => a.localeCompare(b));
      onOptionsChange(category, next);
    } else {
      await loadOptions();
    }

    onChange(trimmed);
    onSelect?.(trimmed);
    setOpen(false);
    setSearch("");
  }

  function selectOption(option: string) {
    onChange(option);
    onSelect?.(option);
    setOpen(false);
    setSearch("");
  }

  const filtered = options.filter((o) =>
    o.toLowerCase().includes(search.toLowerCase())
  );
  const trimmedSearch = search.trim();
  const canAdd =
    trimmedSearch.length > 0 &&
    !options.some((o) => o.toLowerCase() === trimmedSearch.toLowerCase());

  return (
    <div ref={containerRef} className="relative">
      <label className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {required && " *"}
      </label>

      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-10 w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      >
        <span className={value ? "text-slate-900" : "text-slate-400"}>
          {value || placeholder}
        </span>
        <span className="text-slate-400">▾</span>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search or type new..."
              className="flex h-10 w-full rounded-md border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && canAdd) {
                  e.preventDefault();
                  addOption(trimmedSearch);
                }
              }}
            />
          </div>

          <ul className="max-h-52 overflow-y-auto py-1">
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
      )}
    </div>
  );
}
