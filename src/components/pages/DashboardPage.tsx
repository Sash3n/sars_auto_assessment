"use client";

import Link from "next/link";
import BracketBar from "@/components/charts/BracketBar";
import BreakdownBars from "@/components/charts/BreakdownBars";
import MonthlyBars from "@/components/charts/MonthlyBars";
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
                <Link href="/results" className="btn btn-primary btn-sm">
                  View calculation
                </Link>
              </div>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="label-caps opacity-60">Total income</dt>
                  <dd className="currency text-lg font-semibold">
                    {formatRand(assessment.incomeTotal)}
                  </dd>
                </div>
                <div>
                  <dt className="label-caps opacity-60">PAYE paid</dt>
                  <dd className="currency text-lg font-semibold">
                    {formatRand(assessment.paye)}
                  </dd>
                </div>
                <div>
                  <dt className="label-caps opacity-60">Tax payable</dt>
                  <dd className="currency text-lg font-semibold">
                    {formatRand(assessment.assessedTaxAfterRebates)}
                  </dd>
                </div>
                <div>
                  <dt className="label-caps opacity-60">Effective tax rate</dt>
                  <dd className="currency text-lg font-semibold">
                    {assessment.effectiveRatePercent.toFixed(1)}%
                  </dd>
                </div>
              </dl>
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
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {captureLinks.map((section) => (
              <article
                key={section.href}
                className="card border border-base-300 bg-base-100 shadow-sm"
              >
                <div className="card-body">
                  <h3 className="card-title text-lg">{section.title}</h3>
                  <p className="text-sm leading-relaxed opacity-80">
                    {section.body}
                  </p>
                  <div className="card-actions mt-2">
                    <Link
                      href={section.href}
                      className="btn btn-primary btn-sm"
                    >
                      {section.action}
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
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
