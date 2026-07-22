"use client";

import { normalizeMobile } from "@/lib/jobs";

export function CallCustomerButton({
  mobile,
  className = "",
}: {
  mobile: string;
  className?: string;
}) {
  const digits = normalizeMobile(mobile);
  if (digits.length !== 10) return null;

  return (
    <a
      href={`tel:${digits}`}
      onClick={(e) => e.stopPropagation()}
      aria-label="Call customer"
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 transition-colors hover:bg-emerald-200 ${className}`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="h-4 w-4"
        aria-hidden
      >
        <path
          fillRule="evenodd"
          d="M1.5 4.5a3 3 0 013-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 01-.694 1.954l-1.678 1.339a11.042 11.042 0 005.516 5.516l1.339-1.678a1.875 1.875 0 011.954-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 01-3 3h-2.25C8.602 22.5 1.5 15.398 1.5 6.75V4.5z"
          clipRule="evenodd"
        />
      </svg>
    </a>
  );
}
