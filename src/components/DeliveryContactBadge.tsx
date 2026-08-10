"use client";

import type { DeliveryContactStatus } from "@prisma/client";
import { contactStatusLabel } from "@/lib/delivery-contact";

export function DeliveryContactBadge({
  status,
}: {
  status: DeliveryContactStatus;
}) {
  const contacted = status === "contacted";
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none ${
        contacted
          ? "bg-sky-100 text-sky-800"
          : "bg-amber-100 text-amber-900"
      }`}
    >
      {contactStatusLabel(status)}
    </span>
  );
}
