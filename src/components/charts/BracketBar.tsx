"use client";

import type { BracketView } from "@/lib/analytics";
import { formatRandWhole } from "@/lib/format";

/*
 * Where the taxpayer sits in the bracket table: one horizontal bar, one
 * emerald hue whose opacity steps up with the marginal rate (a sequential
 * ramp), a neutral marker at taxable income. Rate labels are printed in
 * segments wide enough to hold them, so identity never rides on color
 * alone; the full table sits underneath for screen readers and print.
 */
export default function BracketBar({
  view,
  taxableIncome,
}: {
  view: BracketView;
  taxableIncome: number;
}) {
  const rampMin = 0.22;
  const rampMax = 1;
  const steps = view.segments.length;

  return (
    <figure>
      <div className="relative pt-6">
        <div
          className="absolute top-0 -translate-x-1/2 text-xs font-semibold"
          style={{ left: `${view.markerPercent}%` }}
        >
          You
        </div>
        <svg
          viewBox="0 0 100 12"
          preserveAspectRatio="none"
          className="h-12 w-full"
          role="img"
          aria-label={`Taxable income ${formatRandWhole(taxableIncome)} falls in the ${Math.round(view.marginalRate * 100)} percent bracket`}
        >
          {view.segments.map((segment, index) => {
            const x = view.segments
              .slice(0, index)
              .reduce((total, s) => total + s.share, 0);
            const opacity =
              rampMin + (rampMax - rampMin) * (index / Math.max(1, steps - 1));
            return (
              <rect
                key={segment.from}
                x={x + 0.15}
                y={2}
                width={Math.max(0, segment.share - 0.3)}
                height={10}
                rx={0.5}
                fill="var(--chart-1)"
                opacity={opacity}
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
        <div className="pointer-events-none absolute inset-x-0 top-6 flex h-12">
          {view.segments.map((segment, index) => (
            <div
              key={segment.from}
              className="flex items-center justify-center"
              style={{ width: `${segment.share}%` }}
            >
              {segment.share > 7 ? (
                <span
                  className={`text-xs font-semibold ${
                    index >= steps - 3 ? "text-primary-content" : ""
                  }`}
                >
                  {Math.round(segment.rate * 100)}%
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-1 flex justify-between text-xs opacity-60">
        <span>R 0</span>
        <span>{formatRandWhole(view.domainMax)}</span>
      </div>
      <figcaption className="mt-2 text-sm">
        Taxable income{" "}
        <span className="currency font-semibold">
          {formatRandWhole(taxableIncome)}
        </span>{" "}
        sits in the{" "}
        <span className="font-semibold">
          {Math.round(view.marginalRate * 100)}%
        </span>{" "}
        marginal bracket.
      </figcaption>
      <details className="mt-2">
        <summary className="cursor-pointer text-xs opacity-60">
          Bracket table
        </summary>
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
                  {segment.to === null ? "and up" : formatRandWhole(segment.to)}
                </td>
                <td className="text-right">
                  {Math.round(segment.rate * 100)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
