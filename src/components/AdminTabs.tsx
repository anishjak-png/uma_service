"use client";

import { cn } from "@/lib/utils";

const tabs = [
  { id: "devices", label: "Devices" },
  { id: "staff", label: "Staff" },
  { id: "technicians", label: "Technicians" },
  { id: "appliances", label: "Appliances" },
  { id: "customers", label: "Customers" },
  { id: "whatsapp", label: "WhatsApp" },
] as const;

export type AdminSettingsTab = (typeof tabs)[number]["id"];
export type AdminTab = AdminSettingsTab | "reports";

export function AdminTabs({
  active,
  onChange,
  pendingDeviceCount = 0,
}: {
  active: AdminSettingsTab;
  onChange: (tab: AdminSettingsTab) => void;
  pendingDeviceCount?: number;
}) {
  return (
    <div className="mb-3 flex flex-wrap gap-1 rounded-md border border-slate-200 bg-white p-0.5">
      {tabs.map((tab) => {
        const label =
          tab.id === "devices" && pendingDeviceCount > 0
            ? `${tab.label} (${pendingDeviceCount})`
            : tab.label;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              "min-w-[4.5rem] flex-1 rounded px-2 py-2 text-xs font-medium transition-colors",
              active === tab.id
                ? "bg-emerald-600 text-white"
                : "text-slate-600 hover:bg-slate-50"
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
