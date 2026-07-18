"use client";

import Link from "next/link";
import BracketBar from "@/components/charts/BracketBar";
import BreakdownBars from "@/components/charts/BreakdownBars";
import MonthlyBars from "@/components/charts/MonthlyBars";
import StatTile from "@/components/ui/StatTile";
import {
  bracketSegments,
  deductionBreakdown,
  monthlyPayrollSeries,
  yearOverYear,
} from "@/lib/analytics";
import { formatRand } from "@/lib/format";
import { useActiveYear, useStore } from "@/lib/store/StoreProvider";
import { composeAssessment } from "@/lib/tax-engine/assessment";
import { getTaxYear } from "@/lib/tax-engine/tax-tables";

const iconProps = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function IncomeIcon() {
  return (
    <svg {...iconProps} aria-hidden="true">
      <path d="M12 3v12m0-12 4 4m-4-4-4 4" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}

function PayeIcon() {
  return (
    <svg {...iconProps} aria-hidden="true">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 7h8m-8 4h8m-8 4h4" />
    </svg>
  );
}

function TaxIcon() {
  return (
    <svg {...iconProps} aria-hidden="true">
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H7" />
    </svg>
  );
}

function RateIcon() {
  return (
    <svg {...iconProps} aria-hidden="true">
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="6" r="2" />
      <path d="m5 19 14-14" />
    </svg>
  );
}

function CaptureLinksBento({ condensed }: { condensed?: boolean }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {captureLinks.map((section) => (
        <article
          key={section.href}
          className="card border border-base-300 bg-base-100 shadow-sm"
        >
          <div className="card-body">
            <h3 className="card-title text-lg">{section.title}</h3>
            {condensed ? null : (
              <p className="text-sm leading-relaxed opacity-80">
                {section.body}
              </p>
            )}
            <div className="card-actions mt-2">
              <Link href={section.href} className="btn btn-primary btn-sm">
                {section.action}
              </Link>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

const captureLinks = [
  {
    href: "/income",
    title: "Employment income",
    body: "Capture every payslip: any number of employers, months, allowances, and fringe benefits.",
    action: "Capture payslips",
  },
  {
    href: "/other-income",
    title: "Other income",
    body: "Rental properties with expense apportionment, freelance income, interest, dividends, and capital disposals.",
    action: "Capture other income",
  },
  {
    href: "/deductions",
    title: "Deductions and household",
    body: "Your details, medical costs, retirement annuities, donations, home office, and a full dependents model.",
    action: "Capture deductions",
  },
];

export default function DashboardPage() {
  const { state } = useStore();
  const year = useActiveYear();
  const tables = getTaxYear(year.taxYearId);
  const assessment = composeAssessment(year, tables);
  const hasData = assessment.incomeTotal > 0;
  const refund = assessment.netAmount < 0;

  const monthly = monthlyPayrollSeries(year, tables);
  const hasPayroll = monthly.some((point) => point.income > 0);
  const breakdown = deductionBreakdown(assessment);
  const brackets = bracketSegments(tables, assessment.taxableIncome);
  const years = yearOverYear(state);

  return (
    <div className="space-y-6">
      {hasData ? (
        <>
          <section
            className={`card border shadow-sm ${
              refund
                ? "border-primary/40 bg-primary/10"
                : "border-error/40 bg-error/10"
            }`}
          >
            <div className="card-body">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="label-caps opacity-70">
                    Estimated assessment, {tables.label}
                  </p>
                  <p
                    className={`currency mt-1 text-3xl font-semibold ${
                      refund ? "text-primary" : "text-error"
                    }`}
                  >
                    {refund
                      ? `SARS owes you ${formatRand(Math.abs(assessment.netAmount))}`
                      : `You owe SARS ${formatRand(assessment.netAmount)}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link href="/compare" className="btn btn-primary btn-sm">
                    Compare to SARS
                  </Link>
                  <Link href="/results" className="btn btn-ghost btn-sm">
                    View calculation
                  </Link>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatTile
                  icon={<IncomeIcon />}
                  label="Total income"
                  value={formatRand(assessment.incomeTotal)}
                  href="/income"
                />
                <StatTile
                  icon={<PayeIcon />}
                  label="PAYE paid"
                  value={formatRand(assessment.paye)}
                  href="/results"
                />
                <StatTile
                  icon={<TaxIcon />}
                  label="Tax payable"
                  value={formatRand(assessment.assessedTaxAfterRebates)}
                  href="/results"
                />
                <StatTile
                  icon={<RateIcon />}
                  label="Effective tax rate"
                  value={`${assessment.effectiveRatePercent.toFixed(1)}%`}
                  href="/results"
                />
              </div>
            </div>
          </section>

          <section className="card border border-base-300 bg-base-100 shadow-sm">
            <div className="card-body">
              <h2 className="card-title text-base">Tax brackets</h2>
              <BracketBar
                view={brackets}
                taxableIncome={assessment.taxableIncome}
              />
            </div>
          </section>

          {hasPayroll ? (
            <section className="card border border-base-300 bg-base-100 shadow-sm">
              <div className="card-body">
                <h2 className="card-title text-base">
                  Monthly income and PAYE
                </h2>
                <MonthlyBars points={monthly} />
              </div>
            </section>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="card border border-base-300 bg-base-100 shadow-sm">
              <div className="card-body">
                <h2 className="card-title text-base">Deduction breakdown</h2>
                {breakdown.length > 0 ? (
                  <BreakdownBars slices={breakdown} />
                ) : (
                  <p className="text-sm opacity-70">
                    No deductions captured yet. Retirement contributions,
                    donations, and home office expenses appear here.
                  </p>
                )}
              </div>
            </section>

            <section className="card border border-base-300 bg-base-100 shadow-sm">
              <div className="card-body">
                <h2 className="card-title text-base">Year over year</h2>
                {years.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="table table-sm">
                      <thead>
                        <tr>
                          <th>Tax year</th>
                          <th className="text-right">Total income</th>
                          <th className="text-right">Effective rate</th>
                          <th className="text-right">Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {years.map((summary) => (
                          <tr key={summary.taxYearId} className="hover:bg-base-200">
                            <td>{summary.label}</td>
                            <td className="currency text-right">
                              {formatRand(summary.incomeTotal)}
                            </td>
                            <td className="currency text-right">
                              {summary.effectiveRatePercent.toFixed(1)}%
                            </td>
                            <td
                              className={`currency text-right ${
                                summary.result < 0 ? "text-primary" : "text-error"
                              }`}
                            >
                              {summary.result < 0
                                ? `${formatRand(Math.abs(summary.result))} refund`
                                : `${formatRand(summary.result)} owed`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm opacity-70">
                    Capture more than one tax year to compare income,
                    effective rate, and results across years.
                  </p>
                )}
              </div>
            </section>
          </div>

          <section>
            <h2 className="card-title text-base">Next steps</h2>
            <div className="mt-3">
              <CaptureLinksBento condensed />
            </div>
          </section>
        </>
      ) : (
        <>
          <div>
            <span className="badge badge-accent badge-outline rounded-full">
              Estimate, then compare
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              SARS Auto-Assessment Calculator
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed opacity-80">
              A personal decision-support tool that independently estimates
              what your South African annual assessment (ITA34) should look
              like, built from payslips and other income and deduction
              inputs, so discrepancies in the SARS auto-assessment can be
              caught inside the correction window.
            </p>
          </div>
          <CaptureLinksBento />
          <p className="text-sm opacity-70">
            Once income is captured, this page becomes your dashboard:
            bracket position, monthly trends, deduction breakdown, and
            year-over-year comparisons.
          </p>
        </>
      )}
    </div>
  );
}
