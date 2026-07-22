"use client";

import { cn } from "@/lib/utils";

const tabs = [
  { id: "technicians", label: "Technicians" },
  { id: "appliances", label: "Appliances" },
  { id: "customers", label: "Customers" },
  { id: "reports", label: "Reports" },
] as const;

export type AdminTab = (typeof tabs)[number]["id"];

export function AdminTabs({
  active,
  onChange,
}: {
  active: AdminTab;
  onChange: (tab: AdminTab) => void;
}) {
  return (
    <div className="mb-6 flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            active === tab.id
              ? "bg-emerald-600 text-white"
              : "text-slate-600 hover:bg-slate-50"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
