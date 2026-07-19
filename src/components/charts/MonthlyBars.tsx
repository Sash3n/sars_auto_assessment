"use client";

import type { MonthlyPoint } from "@/lib/analytics";
import { formatRand, formatRandWhole } from "@/lib/format";

/*
 * Grouped bars, two fixed series: income (chart-1) and PAYE (chart-2).
 * Thin marks with a surface gap between pair members, four recessive
 * gridlines, a legend (two series), native tooltips per bar, and a table
 * view underneath.
 */

const WIDTH = 720;
const HEIGHT = 200;
const PAD_LEFT = 56;
const PAD_BOTTOM = 24;
const PAD_TOP = 8;

function niceCeiling(value: number): number {
  if (value <= 0) {
    return 1;
  }
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

export default function MonthlyBars({ points }: { points: MonthlyPoint[] }) {
  const max = niceCeiling(
    Math.max(...points.map((p) => Math.max(p.income, p.paye)), 1),
  );
  const plotWidth = WIDTH - PAD_LEFT - 8;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const groupWidth = plotWidth / points.length;
  const barWidth = Math.min(14, groupWidth / 2 - 4);

  function y(value: number): number {
    return PAD_TOP + plotHeight - (value / max) * plotHeight;
  }

  const gridLines = [0.25, 0.5, 0.75, 1];

  return (
    <figure>
      <div
        className="mb-2 flex items-center gap-4 text-xs"
        aria-hidden="true"
      >
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ background: "var(--chart-1)" }}
          />
          Income
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ background: "var(--chart-2)" }}
          />
          PAYE
        </span>
      </div>
      <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full min-w-[560px]"
        role="img"
        aria-label="Monthly income and PAYE across the tax year"
      >
        {gridLines.map((fraction) => (
          <g key={fraction}>
            <line
              x1={PAD_LEFT}
              x2={WIDTH - 8}
              y1={y(max * fraction)}
              y2={y(max * fraction)}
              stroke="currentColor"
              opacity={0.12}
              strokeWidth={1}
            />
            <text
              x={PAD_LEFT - 6}
              y={y(max * fraction) + 4}
              textAnchor="end"
              fontSize={12}
              fill="currentColor"
              opacity={0.6}
            >
              {formatRandWhole(max * fraction)}
            </text>
          </g>
        ))}
        <line
          x1={PAD_LEFT}
          x2={WIDTH - 8}
          y1={y(0)}
          y2={y(0)}
          stroke="currentColor"
          opacity={0.3}
          strokeWidth={1}
        />
        {points.map((point, index) => {
          const groupX = PAD_LEFT + index * groupWidth + groupWidth / 2;
          return (
            <g key={point.month}>
              {point.income > 0 ? (
                <rect
                  x={groupX - barWidth - 1}
                  y={y(point.income)}
                  width={barWidth}
                  height={y(0) - y(point.income)}
                  rx={2}
                  fill="var(--chart-1)"
                >
                  <title>{`${point.label} income ${formatRand(point.income)}`}</title>
                </rect>
              ) : null}
              {point.paye > 0 ? (
                <rect
                  x={groupX + 1}
                  y={y(point.paye)}
                  width={barWidth}
                  height={y(0) - y(point.paye)}
                  rx={2}
                  fill="var(--chart-2)"
                >
                  <title>{`${point.label} PAYE ${formatRand(point.paye)}`}</title>
                </rect>
              ) : null}
              <text
                x={groupX}
                y={HEIGHT - 7}
                textAnchor="middle"
                fontSize={12}
                fill="currentColor"
                opacity={0.6}
              >
                {point.label.slice(0, 3)}
              </text>
            </g>
          );
        })}
      </svg>
      </div>
      <details className="mt-2">
        <summary className="cursor-pointer text-xs opacity-60">
          Monthly table
        </summary>
        <table className="table table-xs mt-1">
          <thead>
            <tr>
              <th>Month</th>
              <th className="text-right">Income</th>
              <th className="text-right">PAYE</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.month}>
                <td>{point.label}</td>
                <td className="currency text-right">
                  {formatRand(point.income)}
                </td>
                <td className="currency text-right">{formatRand(point.paye)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
