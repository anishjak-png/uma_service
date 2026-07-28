"use client";

import {
  isJobWhatsAppEnabled,
  jobOverrideWhenEnabling,
} from "@/lib/notifications/preference";
import { formatMobileDisplay } from "@/lib/jobs";
import { useState } from "react";

type JobNotificationSettingsProps = {
  jobId: string;
  customerId: string;
  customerMobile: string;
  customerAllows: boolean;
  jobOverride: boolean | null | undefined;
  onCustomerPreferenceChange: (allows: boolean) => void;
  onJobOverrideChange: (override: boolean | null) => void;
};

function ToggleSwitch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
        checked ? "bg-emerald-600" : "bg-slate-300"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? "left-5" : "left-0.5"
        }`}
      />
    </button>
  );
}

export function JobNotificationSettings({
  jobId,
  customerId,
  customerMobile,
  customerAllows,
  jobOverride,
  onCustomerPreferenceChange,
  onJobOverrideChange,
}: JobNotificationSettingsProps) {
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [savingJob, setSavingJob] = useState(false);
  const [error, setError] = useState("");

  const jobEnabled = isJobWhatsAppEnabled({
    customerAllows,
    jobOverride,
  });

  async function updateCustomerPreference(allows: boolean) {
    setSavingCustomer(true);
    setError("");
    const res = await fetch(`/api/customers/${customerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allowWhatsappNotifications: allows }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to update customer preference");
    } else {
      onCustomerPreferenceChange(data.allowWhatsappNotifications);
    }
    setSavingCustomer(false);
  }

  async function updateJobOverride(enabled: boolean) {
    setSavingJob(true);
    setError("");
    const override = enabled ? jobOverrideWhenEnabling(customerAllows) : false;
    const res = await fetch(`/api/jobs/${jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ whatsappNotificationsOverride: override }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to update job notification setting");
    } else {
      onJobOverrideChange(data.whatsappNotificationsOverride ?? null);
    }
    setSavingJob(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-800">Customer WhatsApp</p>
          <p className="text-xs text-slate-500">
            {formatMobileDisplay(customerMobile)} · applies to all future jobs
          </p>
        </div>
        <ToggleSwitch
          checked={customerAllows}
          onChange={updateCustomerPreference}
          disabled={savingCustomer}
        />
      </div>

      <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-800">This Job WhatsApp</p>
          <p className="text-xs text-slate-500">
            {jobOverride === true
              ? "Forced ON for this job"
              : jobOverride === false
                ? "Forced OFF for this job"
                : "Uses customer preference"}
            {jobEnabled ? " · will send" : " · will not send"}
          </p>
        </div>
        <ToggleSwitch
          checked={jobEnabled}
          onChange={updateJobOverride}
          disabled={savingJob}
        />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
