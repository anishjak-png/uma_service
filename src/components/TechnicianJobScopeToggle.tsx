"use client";

import { useCallback, useEffect, useState } from "react";

export type TechnicianJobScope = "my" | "all";

const STORAGE_KEY = "technicianJobScope";

export function useTechnicianJobScope() {
  const [scope, setScopeState] = useState<TechnicianJobScope>("my");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "my" || saved === "all") {
      setScopeState(saved);
    }
    setReady(true);
  }, []);

  const setScope = useCallback((next: TechnicianJobScope) => {
    setScopeState(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  return { scope, setScope, ready };
}

export function TechnicianJobScopeToggle({
  scope,
  onChange,
}: {
  scope: TechnicianJobScope;
  onChange: (scope: TechnicianJobScope) => void;
}) {
  return (
    <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
      <button
        type="button"
        onClick={() => onChange("my")}
        className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          scope === "my"
            ? "bg-emerald-600 text-white"
            : "text-slate-600 hover:bg-slate-50"
        }`}
      >
        My Jobs
      </button>
      <button
        type="button"
        onClick={() => onChange("all")}
        className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          scope === "all"
            ? "bg-emerald-600 text-white"
            : "text-slate-600 hover:bg-slate-50"
        }`}
      >
        All Jobs
      </button>
    </div>
  );
}
