"use client";

import { useState } from "react";
import { parseCurrencyInput } from "@/lib/model/validate";

interface CurrencyFieldProps {
  label: string;
  value: number;
  onChange: (amount: number) => void;
  /** Optional hint rendered under the field. */
  hint?: string;
}

/*
 * Currency input per the design reference: label-caps label, "R" prefix,
 * mono right-aligned value. Free text while typing; the parsed value only
 * propagates when valid, and the text normalises on blur.
 */
export default function CurrencyField({
  label,
  value,
  onChange,
  hint,
}: CurrencyFieldProps) {
  const [text, setText] = useState(value === 0 ? "" : value.toFixed(2));

  function handleChange(raw: string) {
    setText(raw);
    const parsed = parseCurrencyInput(raw);
    if (parsed !== null) {
      onChange(parsed);
    } else if (raw.trim() === "") {
      onChange(0);
    }
  }

  function handleBlur() {
    const parsed = parseCurrencyInput(text);
    setText(parsed === null || parsed === 0 ? "" : parsed.toFixed(2));
  }

  return (
    <label className="form-control w-full">
      <span className="label-caps mb-1 block opacity-70">{label}</span>
      <div className="input input-bordered flex w-full items-center gap-2">
        <span className="opacity-60">R</span>
        <input
          type="text"
          inputMode="decimal"
          className="currency w-full grow bg-transparent text-right outline-none"
          value={text}
          placeholder="0.00"
          aria-label={label}
          onChange={(event) => handleChange(event.target.value)}
          onBlur={handleBlur}
        />
      </div>
      {hint ? (
        <span className="mt-1 block text-xs opacity-60">{hint}</span>
      ) : null}
    </label>
  );
}
