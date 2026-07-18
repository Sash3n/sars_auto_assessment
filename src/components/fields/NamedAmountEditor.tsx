"use client";

import { newId } from "@/lib/model/ids";
import type { NamedAmount } from "@/lib/model/types";
import { sanitizeLabel } from "@/lib/model/validate";
import CurrencyField from "./CurrencyField";

interface NamedAmountEditorProps {
  title: string;
  addLabel: string;
  items: NamedAmount[];
  onChange: (items: NamedAmount[]) => void;
}

/** Editable list of named amounts: allowances, fringe benefits, expenses. */
export default function NamedAmountEditor({
  title,
  addLabel,
  items,
  onChange,
}: NamedAmountEditorProps) {
  function update(id: string, patch: Partial<NamedAmount>) {
    onChange(
      items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  return (
    <fieldset className="rounded-box border border-base-300 p-4">
      <legend className="label-caps px-1 opacity-70">{title}</legend>
      {items.length === 0 ? (
        <p className="text-sm opacity-60">None captured.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="flex items-end gap-2">
              <label className="form-control grow">
                <span className="label-caps mb-1 block opacity-70">
                  Description
                </span>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  value={item.label}
                  aria-label={`${title} description`}
                  onChange={(event) =>
                    update(item.id, {
                      label: sanitizeLabel(event.target.value),
                    })
                  }
                />
              </label>
              <div className="w-44">
                <CurrencyField
                  label="Amount"
                  value={item.amount}
                  onChange={(amount) => update(item.id, { amount })}
                />
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm text-error"
                aria-label={`Remove ${item.label || title.toLowerCase()}`}
                onClick={() =>
                  onChange(items.filter((other) => other.id !== item.id))
                }
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className="btn btn-outline btn-sm mt-3"
        onClick={() =>
          onChange([...items, { id: newId(), label: "", amount: 0 }])
        }
      >
        {addLabel}
      </button>
    </fieldset>
  );
}
