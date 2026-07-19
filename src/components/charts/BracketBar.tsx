"use client";

import type { BracketView } from "@/lib/analytics";
import { formatRandWhole } from "@/lib/format";

/*
 * Where the taxpayer sits in the bracket table: one horizontal bar, one
 * emerald hue whose opacity steps up with the marginal rate (a sequential
 * ramp), a neutral marker at taxable income. Because a linear rand scale
 * crushes the lower brackets into slivers, the per-rate labels live in a
 * wrapping legend below the bar rather than inside the segments, so every
 * rate stays readable at any width. The full table sits underneath for
 * screen readers and print.
 */

const RAMP_MIN = 0.22;
const RAMP_MAX = 1;

function opacityForIndex(index: number, steps: number): number {
  return RAMP_MIN + (RAMP_MAX - RAMP_MIN) * (index / Math.max(1, steps - 1));
}

export default function BracketBar({
  view,
  taxableIncome,
}: {
  view: BracketView;
  taxableIncome: number;
}) {
  const steps = view.segments.length;
  const marginalRatePercent = Math.round(view.marginalRate * 100);

  return (
    <figure>
      <div className="relative pt-6">
        {taxableIncome > 0 ? (
          <div
            className="absolute top-0 flex -translate-x-1/2 flex-col items-center text-xs font-semibold"
            style={{ left: `${Math.min(96, Math.max(4, view.markerPercent))}%` }}
          >
            You
          </div>
        ) : null}
        <svg
          viewBox="0 0 100 12"
          preserveAspectRatio="none"
          className="h-10 w-full"
          role="img"
          aria-label={`Taxable income ${formatRandWhole(taxableIncome)} falls in the ${marginalRatePercent} percent bracket`}
        >
          {view.segments.map((segment, index) => {
            const x = view.segments
              .slice(0, index)
              .reduce((total, s) => total + s.share, 0);
            return (
              <rect
                key={segment.from}
                x={x + 0.15}
                y={2}
                width={Math.max(0, segment.share - 0.3)}
                height={8}
                rx={0.5}
                fill="var(--chart-1)"
                opacity={opacityForIndex(index, steps)}
              >
                <title>
                  {`${Math.round(segment.rate * 100)}% from ${formatRandWhole(segment.from)}${segment.to === null ? " up" : ` to ${formatRandWhole(segment.to)}`}`}
                </title>
              </rect>
            );
          })}
          {taxableIncome > 0 ? (
            <line
              x1={view.markerPercent}
              x2={view.markerPercent}
              y1={0}
              y2={12}
              stroke="currentColor"
              strokeWidth={0.4}
            />
          ) : null}
        </svg>
      </div>
      <div className="mt-1 flex justify-between text-xs opacity-60">
        <span>R 0</span>
        <span>{formatRandWhole(view.domainMax)}</span>
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
        {view.segments.map((segment, index) => {
          const rate = Math.round(segment.rate * 100);
          const active = segment.containsMarker && taxableIncome > 0;
          return (
            <li
              key={segment.from}
              className={`flex items-center gap-1.5 text-xs ${
                active ? "font-semibold" : "opacity-80"
              }`}
            >
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{
                  background: "var(--chart-1)",
                  opacity: opacityForIndex(index, steps),
                }}
              />
              <span className="whitespace-nowrap">
                {rate}%{active ? " (you)" : ""}
              </span>
            </li>
          );
        })}
      </ul>

      <figcaption className="mt-3 text-sm">
        Taxable income{" "}
        <span className="currency font-semibold">
          {formatRandWhole(taxableIncome)}
        </span>{" "}
        sits in the{" "}
        <span className="font-semibold">{marginalRatePercent}%</span> marginal
        bracket.
      </figcaption>
      <details className="mt-2">
        <summary className="cursor-pointer text-xs opacity-60">
          Bracket table
        </summary>
        <div className="overflow-x-auto">
          <table className="table table-xs mt-1">
            <thead>
              <tr>
                <th>From</th>
                <th>To</th>
                <th className="text-right">Rate</th>
              </tr>
            </thead>
            <tbody>
              {view.segments.map((segment) => (
                <tr key={segment.from}>
                  <td className="currency">{formatRandWhole(segment.from)}</td>
                  <td className="currency">
                    {segment.to === null
                      ? "and up"
                      : formatRandWhole(segment.to)}
                  </td>
                  <td className="text-right">
                    {Math.round(segment.rate * 100)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
