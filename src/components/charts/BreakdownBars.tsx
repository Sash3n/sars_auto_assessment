"use client";

import type { BreakdownSlice } from "@/lib/analytics";
import { formatRand } from "@/lib/format";

/*
 * Deduction proportions as horizontal bars. Fixed color assignment by row
 * order (chart-1..3, then neutral), amounts and percentages printed as
 * text, so nothing rides on color alone.
 */
const SERIES_VARS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"];

export default function BreakdownBars({
  slices,
}: {
  slices: BreakdownSlice[];
}) {
  const maxPercent = Math.max(...slices.map((slice) => slice.percent), 1);
  return (
    <ul className="space-y-3">
      {slices.map((slice, index) => (
        <li key={slice.label}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{
                  background:
                    SERIES_VARS[index] ?? "var(--color-neutral)",
                }}
                aria-hidden="true"
              />
              {slice.label}
            </span>
            <span className="currency text-sm">
              {formatRand(slice.amount)}{" "}
              <span className="opacity-60">({slice.percent.toFixed(1)}%)</span>
            </span>
          </div>
          <div
            className="h-2 w-full rounded-full bg-base-300"
            role="img"
            aria-label={`${slice.label}: ${slice.percent.toFixed(1)} percent of deductions`}
          >
            <div
              className="h-2 rounded-full"
              style={{
                width: `${(slice.percent / maxPercent) * 100}%`,
                background: SERIES_VARS[index] ?? "var(--color-neutral)",
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
