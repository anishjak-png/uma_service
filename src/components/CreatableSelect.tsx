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
}

export function CreatableSelect({
  category,
  label,
  value,
  onChange,
  required,
  placeholder = "Select or add new",
  onSelect,
}: CreatableSelectProps) {
  const [options, setOptions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const loadOptions = useCallback(async () => {
    const res = await fetch(`/api/lookups?category=${category}`);
    const data = await res.json();
    setOptions(data.map((o: { value: string }) => o.value));
  }, [category]);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

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

    await loadOptions();
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
      <label className="mb-1 block text-sm font-medium text-gray-700">
        {label}
        {required && " *"}
      </label>

      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-xl border border-gray-300 bg-white px-4 py-3 text-left focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
      >
        <span className={value ? "text-gray-900" : "text-gray-400"}>
          {value || placeholder}
        </span>
        <span className="text-gray-400">▾</span>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 p-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search or type new..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
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
                  className="w-full px-4 py-3 text-left text-sm font-medium text-orange-600 hover:bg-orange-50"
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
                  className={`w-full px-4 py-3 text-left text-sm hover:bg-gray-50 ${
                    option === value ? "bg-orange-50 font-semibold text-orange-700" : "text-gray-800"
                  }`}
                >
                  {option}
                </button>
              </li>
            ))}

            {filtered.length === 0 && !canAdd && (
              <li className="px-4 py-3 text-sm text-gray-400">No options found</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
