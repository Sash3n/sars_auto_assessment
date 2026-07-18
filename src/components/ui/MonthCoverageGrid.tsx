"use client";

import { monthlyPayrollSeries } from "@/lib/analytics";
import { formatRand } from "@/lib/format";
import { useActiveYear } from "@/lib/store/StoreProvider";
import { getTaxYear } from "@/lib/tax-engine/tax-tables";

/*
 * Twelve-month capture tracker per the design reference: one chip per tax
 * year month showing whether a payslip is captured, with an anomaly flag
 * on months well above the typical month (a bonus month, or a double
 * capture worth checking).
 */
export default function MonthCoverageGrid() {
  const year = useActiveYear();
  const tables = getTaxYear(year.taxYearId);
  const series = monthlyPayrollSeries(year, tables);

  const captured = series.filter((point) => point.income > 0);
  const sorted = captured.map((point) => point.income).sort((a, b) => a - b);
  const median =
    sorted.length > 0
      ? sorted.length % 2 === 1
        ? sorted[(sorted.length - 1) / 2]
        : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : 0;

  return (
    <section
      className="card border border-base-300 bg-base-100 shadow-sm"
      aria-labelledby="month-coverage-heading"
    >
      <div className="card-body gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="month-coverage-heading" className="card-title text-base">
            Months captured
          </h3>
          <span className="badge badge-ghost rounded-full">
            {captured.length} of {series.length}
          </span>
        </div>
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {series.map((point) => {
            const isCaptured = point.income > 0;
            const isHigh =
              isCaptured && median > 0 && point.income > median * 1.5;
            const percentAbove =
              isHigh && median > 0
                ? Math.round(((point.income - median) / median) * 100)
                : 0;
            return (
              <li
                key={point.month}
                className={`rounded-box border p-2 text-center text-xs ${
                  isCaptured
                    ? isHigh
                      ? "border-warning/60 bg-warning/10"
                      : "border-primary/40 bg-primary/5"
                    : "border-dashed border-base-300 opacity-60"
                }`}
              >
                <p className="font-semibold">{point.label}</p>
                {isCaptured ? (
                  <>
                    <p className="currency mt-0.5">{formatRand(point.income)}</p>
                    {isHigh ? (
                      <p className="mt-0.5 text-warning">
                        +{percentAbove}% vs typical
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p className="mt-0.5">Pending</p>
                )}
              </li>
            );
          })}
        </ul>
        {captured.length > 0 && captured.length < series.length ? (
          <p className="text-xs opacity-60">
            Months marked pending have no payslip captured yet. A partial
            year is fine if you only worked part of the year.
          </p>
        ) : null}
      </div>
    </section>
  );
}
