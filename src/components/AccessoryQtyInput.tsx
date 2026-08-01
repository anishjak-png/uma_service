"use client";

import { useEffect, useState } from "react";

type AccessoryQtyInputProps = {
  value: number;
  onChange: (qty: number) => void;
  className?: string;
  "aria-label"?: string;
};

export function AccessoryQtyInput({
  value,
  onChange,
  className,
  "aria-label": ariaLabel,
}: AccessoryQtyInputProps) {
  const [text, setText] = useState(String(value));

  useEffect(() => {
    setText(String(value));
  }, [value]);

  return (
    <input
      type="text"
      inputMode="numeric"
      value={text}
      aria-label={ariaLabel}
      className={className}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "").slice(0, 3);
        setText(digits);
        if (digits) {
          onChange(Math.max(1, Math.min(999, parseInt(digits, 10))));
        }
      }}
      onBlur={() => {
        const parsed = parseInt(text, 10);
        const qty =
          Number.isFinite(parsed) && parsed >= 1 ? Math.min(999, parsed) : 1;
        setText(String(qty));
        onChange(qty);
      }}
    />
  );
}
