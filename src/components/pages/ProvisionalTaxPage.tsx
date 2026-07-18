"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import CurrencyField from "@/components/fields/CurrencyField";
import { formatRand } from "@/lib/format";
import { useActiveYear, useStore } from "@/lib/store/StoreProvider";
import { composeAssessment } from "@/lib/tax-engine/assessment";
import { calculateIrp6, type Irp6MethodResult } from "@/lib/tax-engine/irp6";
import { getTaxYear, listTaxYears } from "@/lib/tax-engine/tax-tables";

/*
 * The basic amount method legally requires the taxpayer's most recently
 * SARS-assessed taxable income, not this app's own estimate. If a prior tax
 * year is stored with data, its app-calculated taxable income is offered as
 * a starting point, clearly labelled as an estimate the user should
 * override with their real assessed figure if it differs.
 */
function priorYearDefault(
  activeTaxYearId: string,
  years: Record<string, { payslips: unknown[] } | undefined>,
): number | null {
  const ordered = listTaxYears();
  const activeIndex = ordered.findIndex((y) => y.id === activeTaxYearId);
  if (activeIndex <= 0) {
    return null;
  }
  const priorId = ordered[activeIndex - 1].id;
  const priorYear = years[priorId];
  if (!priorYear || priorYear.payslips.length === 0) {
    return null;
  }
  const assessment = composeAssessment(
    priorYear as Parameters<typeof composeAssessment>[0],
    getTaxYear(priorId),
  );
  return assessment.taxableIncome;
}

function MethodCard({
  title,
  result,
}: {
  title: string;
  result: Irp6MethodResult | null;
}) {
  if (!result) {
    return (
      <section className="card border border-dashed border-base-300 bg-base-100">
        <div className="card-body">
          <h3 className="card-title text-base">{title}</h3>
          <p className="text-sm opacity-70">
            Not available: enter your prior year&apos;s SARS-assessed taxable
            income to see this method.
          </p>
        </div>
      </section>
    );
  }
  return (
    <section className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body gap-3">
        <h3 className="card-title text-base">{title}</h3>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="label-caps opacity-60">Taxable income used</dt>
            <dd className="currency text-lg font-semibold">
              {formatRand(result.taxableIncomeUsed)}
            </dd>
          </div>
          <div>
            <dt className="label-caps opacity-60">Tax on that estimate</dt>
            <dd className="currency text-lg font-semibold">
              {formatRand(result.taxOnEstimate)}
            </dd>
          </div>
          <div>
            <dt className="label-caps opacity-60">
              First payment, due 31 August
            </dt>
            <dd className="currency text-xl font-semibold text-primary">
              {formatRand(result.firstPeriodPayment)}
            </dd>
          </div>
          <div>
            <dt className="label-caps opacity-60">
              Second payment, due end of February
            </dt>
            <dd className="currency text-xl font-semibold text-primary">
              {formatRand(result.secondPeriodPayment)}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

export default function ProvisionalTaxPage() {
  const { state } = useStore();
  const year = useActiveYear();
  const tables = getTaxYear(year.taxYearId);
  const assessment = useMemo(
    () => composeAssessment(year, tables),
    [year, tables],
  );

  const defaultPriorYear = useMemo(
    () => priorYearDefault(state.activeTaxYearId, state.years),
    [state.activeTaxYearId, state.years],
  );
  const [priorYearTaxableIncome, setPriorYearTaxableIncome] = useState(
    defaultPriorYear ?? 0,
  );
  const [hasPriorYear, setHasPriorYear] = useState(defaultPriorYear !== null);
  const [overEighteenMonths, setOverEighteenMonths] = useState(false);

  const result = useMemo(
    () =>
      calculateIrp6(
        {
          priorYearTaxableIncome: hasPriorYear ? priorYearTaxableIncome : null,
          priorAssessmentOverEighteenMonthsOld: overEighteenMonths,
          currentYear: assessment,
        },
        tables,
      ),
    [hasPriorYear, priorYearTaxableIncome, overEighteenMonths, assessment, tables],
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Provisional tax (IRP6)
        </h2>
        <p className="mt-1 text-sm opacity-70">
          Estimated first and second provisional payments for {tables.label},
          using both SARS methods. Not a substitute for the IRP6 return on
          eFiling, use these figures to sanity-check what you file.
        </p>
      </div>

      {!assessment.provisionalTaxpayerLikely ? (
        <div role="alert" className="alert alert-info">
          <span>
            Your captured non-PAYE income does not currently suggest you are
            a provisional taxpayer. These figures are still shown in case
            your situation differs from what has been captured.
          </span>
        </div>
      ) : null}

      <section className="card border border-base-300 bg-base-100 shadow-sm">
        <div className="card-body gap-4">
          <h3 className="card-title text-base">Basic amount inputs</h3>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="checkbox"
              checked={hasPriorYear}
              onChange={(event) => setHasPriorYear(event.target.checked)}
            />
            <span className="text-sm">
              I know my taxable income from my most recent SARS assessment
            </span>
          </label>
          {hasPriorYear ? (
            <>
              <div className="max-w-xs">
                <CurrencyField
                  label="Prior year SARS-assessed taxable income"
                  value={priorYearTaxableIncome}
                  onChange={setPriorYearTaxableIncome}
                  hint={
                    defaultPriorYear !== null
                      ? "Pre-filled from this app's own calculation for the prior tax year captured here. Override with your real SARS-assessed figure if it differs."
                      : undefined
                  }
                />
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={overEighteenMonths}
                  onChange={(event) =>
                    setOverEighteenMonths(event.target.checked)
                  }
                />
                <span className="text-sm">
                  That assessment is more than 18 months old (adds an 8
                  percent uplift)
                </span>
              </label>
            </>
          ) : null}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <MethodCard
          title="Basic amount method"
          result={result.basicAmountMethod}
        />
        <MethodCard
          title="Estimated income method"
          result={result.estimatedIncomeMethod}
        />
      </div>

      {result.estimatedIncomeMethod.penaltyRiskNote ? (
        <div role="alert" className="alert alert-warning">
          <span>{result.estimatedIncomeMethod.penaltyRiskNote}</span>
        </div>
      ) : null}

      <p className="text-xs opacity-60">
        Both payments assume employees&apos; tax already withheld splits
        evenly across the year, since this app does not track PAYE by
        half-year. The voluntary third top-up payment, due about seven
        months after year end to stop interest accruing, is not calculated
        here.
      </p>

      <div className="flex justify-end">
        <Link href="/results" className="btn btn-ghost">
          Back to results
        </Link>
      </div>
    </div>
  );
}
