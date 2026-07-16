"use client";

import Link from "next/link";
import { formatRand } from "@/lib/format";
import { useActiveYear } from "@/lib/store/StoreProvider";
import { composeAssessment } from "@/lib/tax-engine/assessment";
import { getTaxYear } from "@/lib/tax-engine/tax-tables";

function AmountRow({
  description,
  amount,
  code,
  strong,
}: {
  description: string;
  amount: number;
  code?: string;
  strong?: boolean;
}) {
  return (
    <tr className={strong ? "font-semibold" : "hover:bg-base-200"}>
      <td className="w-20 font-mono text-xs opacity-60">{code ?? ""}</td>
      <td>{description}</td>
      <td className="currency text-right">{formatRand(amount)}</td>
    </tr>
  );
}

export default function ResultsPage() {
  const year = useActiveYear();
  const tables = getTaxYear(year.taxYearId);
  const assessment = composeAssessment(year, tables);
  const hasData = assessment.incomeTotal > 0;
  const refund = assessment.netAmount < 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Estimated assessment
        </h2>
        <p className="mt-1 text-sm opacity-70">
          Composed from everything captured for the {tables.label} tax year,
          in the same structure as the SARS ITA34.
        </p>
      </div>

      {hasData ? (
        <>
          <section
            className={`card border shadow-sm ${
              refund
                ? "border-primary/40 bg-primary/10"
                : "border-error/40 bg-error/10"
            }`}
            aria-labelledby="verdict-heading"
          >
            <div className="card-body">
              <p id="verdict-heading" className="label-caps opacity-70">
                Estimated result
              </p>
              <p
                className={`currency text-3xl font-semibold ${
                  refund ? "text-primary" : "text-error"
                }`}
              >
                {refund
                  ? `SARS owes you ${formatRand(Math.abs(assessment.netAmount))}`
                  : `You owe SARS ${formatRand(assessment.netAmount)}`}
              </p>
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

          {assessment.provisionalTaxpayerLikely ? (
            <div role="alert" className="alert alert-warning">
              <span>
                Your non-PAYE income (interest, rental, freelance) suggests
                you likely qualify as a provisional taxpayer, with IRP6
                payments due at the end of August and February. Verify your
                registration status with SARS.
              </span>
            </div>
          ) : null}

          {assessment.warnings.map((warning) => (
            <div key={warning} role="alert" className="alert alert-info">
              <span>{warning}</span>
            </div>
          ))}

          <section className="card border border-base-300 bg-base-100 shadow-sm">
            <div className="card-body">
              <h3 className="card-title text-base">Income</h3>
              <div className="overflow-x-auto">
                <table className="table">
                  <tbody>
                    {assessment.incomeLines.map((line) => (
                      <AmountRow
                        key={`${line.code ?? line.description}`}
                        code={line.code}
                        description={line.description}
                        amount={line.amount}
                      />
                    ))}
                    <AmountRow
                      description="Income"
                      amount={assessment.incomeTotal}
                      strong
                    />
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="card border border-base-300 bg-base-100 shadow-sm">
            <div className="card-body">
              <h3 className="card-title text-base">Deductions allowed</h3>
              {assessment.deductionLines.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="table">
                    <tbody>
                      {assessment.deductionLines.map((line) => (
                        <AmountRow
                          key={`${line.code ?? line.description}`}
                          code={line.code}
                          description={line.description}
                          amount={line.amount}
                        />
                      ))}
                      <AmountRow
                        description="Deductions allowed"
                        amount={-assessment.deductionsTotal}
                        strong
                      />
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm opacity-70">No deductions captured.</p>
              )}
            </div>
          </section>

          <section className="card border border-base-300 bg-base-100 shadow-sm">
            <div className="card-body">
              <h3 className="card-title text-base">Tax calculation</h3>
              <div className="overflow-x-auto">
                <table className="table">
                  <tbody>
                    <AmountRow
                      description="Taxable income"
                      amount={assessment.taxableIncome}
                      strong
                    />
                    <AmountRow
                      description="Normal tax on taxable income"
                      amount={assessment.taxBeforeRebates}
                    />
                    <AmountRow
                      description={`Rebates (age ${assessment.age})`}
                      amount={-assessment.rebates}
                    />
                    {assessment.medicalSchemeCredit > 0 ? (
                      <AmountRow
                        description="Medical scheme fees tax credit (s6A)"
                        amount={-assessment.medicalSchemeCredit}
                      />
                    ) : null}
                    {assessment.additionalMedicalCredit > 0 ? (
                      <AmountRow
                        description="Additional medical expenses credit (s6B)"
                        amount={-assessment.additionalMedicalCredit}
                      />
                    ) : null}
                    <AmountRow
                      description="Assessed tax after rebates"
                      amount={assessment.assessedTaxAfterRebates}
                      strong
                    />
                    <AmountRow
                      description="Tax credits and adjustments (PAYE, 4102)"
                      amount={-assessment.paye}
                    />
                    <AmountRow
                      description="Assessment result"
                      amount={assessment.assessmentResult}
                      strong
                    />
                  </tbody>
                </table>
              </div>
              {assessment.retirement.carriedForward > 0 ? (
                <p className="text-sm opacity-70">
                  Retirement contributions carried forward:{" "}
                  <span className="currency">
                    {formatRand(assessment.retirement.carriedForward)}
                  </span>
                </p>
              ) : null}
            </div>
          </section>

          <div className="flex justify-end">
            <Link href="/compare" className="btn btn-primary">
              Compare with the SARS assessment
            </Link>
          </div>
        </>
      ) : (
        <div className="card border border-dashed border-base-300 bg-base-100">
          <div className="card-body items-center text-center">
            <p className="opacity-70">
              Nothing captured yet for {tables.label}. Start with your
              payslips, then other income and deductions.
            </p>
            <Link href="/income" className="btn btn-primary btn-sm">
              Capture income
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
