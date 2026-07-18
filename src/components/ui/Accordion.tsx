"use client";

import { useState, type ReactNode } from "react";

/*
 * Collapsible section per the design reference: a summary row with the
 * section title and an optional right-aligned figure, expanding to the
 * full content. Built on native details/summary so it stays keyboard and
 * screen-reader accessible without extra wiring.
 */
export default function Accordion({
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  /** Optional right-aligned summary figure shown while collapsed. */
  summary?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details
      className="collapse collapse-arrow border border-base-300 bg-base-100"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="collapse-title min-h-0 py-3 pr-10">
        <span className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-lg font-semibold">{title}</span>
          {summary !== undefined ? (
            <span className="currency text-sm font-semibold opacity-80">
              {summary}
            </span>
          ) : null}
        </span>
      </summary>
      <div className="collapse-content space-y-4">{children}</div>
    </details>
  );
}
