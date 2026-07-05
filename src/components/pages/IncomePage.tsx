"use client";

import Link from "next/link";
import { useState } from "react";
import CurrencyField from "@/components/fields/CurrencyField";
import NamedAmountEditor from "@/components/fields/NamedAmountEditor";
import { formatRand } from "@/lib/format";
import { aggregatePayslips } from "@/lib/model/aggregate";
import { emptyPayslip } from "@/lib/model/defaults";
import { monthsOfTaxYear } from "@/lib/model/months";
import type { Payslip } from "@/lib/model/types";
import { sanitizeLabel } from "@/lib/model/validate";
import { useActiveYear, useStore } from "@/lib/store/StoreProvider";
import { getTaxYear } from "@/lib/tax-engine/tax-tables";

function PayslipForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: Payslip;
  onSave: (payslip: Payslip) => void;
  onCancel: () => void;
}) {
  const { state } = useStore();
  const [draft, setDraft] = useState<Payslip>(initial);
  const months = monthsOfTaxYear(getTaxYear(state.activeTaxYearId));

  function patch(update: Partial<Payslip>) {
    setDraft((current) => ({ ...current, ...update }));
  }

  return (
    <form
      className="card border border-base-300 bg-base-100 shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(draft);
      }}
    >
      <div className="card-body gap-4">
        <h3 className="card-title text-base">
          {initial.employer === "" ? "New payslip" : `Edit: ${initial.employer}`}
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="form-control w-full">
            <span className="label-caps mb-1 block opacity-70">Employer</span>
            <input
              type="text"
              className="input input-bordered w-full"
              value={draft.employer}
              required
              aria-label="Employer"
              onChange={(event) =>
                patch({ employer: sanitizeLabel(event.target.value) })
              }
            />
          </label>
          <label className="form-control w-full">
            <span className="label-caps mb-1 block opacity-70">Month</span>
            <select
              className="select select-bordered w-full"
              value={draft.periodMonth}
              aria-label="Month"
              onChange={(event) => patch({ periodMonth: event.target.value })}
            >
              {months.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </label>
          <CurrencyField
            label="Basic salary"
            value={draft.basicSalary}
            onChange={(basicSalary) => patch({ basicSalary })}
          />
          <CurrencyField
            label="Annual bonus"
            value={draft.annualBonus}
            onChange={(annualBonus) => patch({ annualBonus })}
          />
          <CurrencyField
            label="Leave pay"
            value={draft.leavePay}
            onChange={(leavePay) => patch({ leavePay })}
          />
          <CurrencyField
            label="PAYE"
            value={draft.paye}
            onChange={(paye) => patch({ paye })}
            hint="Employees' tax withheld this month"
          />
          <CurrencyField
            label="UIF"
            value={draft.uif}
            onChange={(uif) => patch({ uif })}
          />
          <CurrencyField
            label="Employee retirement contribution"
            value={draft.employeeRetirement}
            onChange={(employeeRetirement) => patch({ employeeRetirement })}
          />
          <CurrencyField
            label="Employer retirement contribution"
            value={draft.employerRetirement}
            onChange={(employerRetirement) => patch({ employerRetirement })}
            hint="Fringe benefit, SARS code 3817"
          />
          <CurrencyField
            label="Employer medical aid contribution"
            value={draft.employerMedicalAid}
            onChange={(employerMedicalAid) => patch({ employerMedicalAid })}
            hint="Fringe benefit, SARS code 3805"
          />
        </div>
        <NamedAmountEditor
          title="Allowances"
          addLabel="Add allowance"
          items={draft.allowances}
          onChange={(allowances) => patch({ allowances })}
        />
        <NamedAmountEditor
          title="Other fringe benefits"
          addLabel="Add fringe benefit"
          items={draft.otherFringeBenefits}
          onChange={(otherFringeBenefits) => patch({ otherFringeBenefits })}
        />
        <NamedAmountEditor
          title="Non-tax deductions"
          addLabel="Add non-tax deduction"
          items={draft.nonTaxDeductions}
          onChange={(nonTaxDeductions) => patch({ nonTaxDeductions })}
        />
        <div className="card-actions justify-end">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Save payslip
          </button>
        </div>
      </div>
    </form>
  );
}

export default function IncomePage() {
  const { state, dispatch } = useStore();
  const year = useActiveYear();
  const [editing, setEditing] = useState<Payslip | null>(null);
  const totals = aggregatePayslips(year.payslips);
  const months = monthsOfTaxYear(getTaxYear(state.activeTaxYearId));
  const monthLabel = new Map(months.map((m) => [m.value, m.label]));

  const sorted = [...year.payslips].sort((a, b) =>
    a.periodMonth === b.periodMonth
      ? a.employer.localeCompare(b.employer)
      : a.periodMonth.localeCompare(b.periodMonth),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Employment income
          </h2>
          <p className="mt-1 text-sm opacity-70">
            Capture every payslip for the year. Any number of employers and
            months is supported.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/income/upload" className="btn btn-outline">
            Upload payslip
          </Link>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setEditing(emptyPayslip(months[0].value))}
          >
            Add payslip
          </button>
        </div>
      </div>

      {editing ? (
        <PayslipForm
          initial={editing}
          onCancel={() => setEditing(null)}
          onSave={(payslip) => {
            dispatch({ type: "upsertPayslip", payslip });
            setEditing(null);
          }}
        />
      ) : null}

      {sorted.length === 0 && !editing ? (
        <div className="card border border-dashed border-base-300 bg-base-100">
          <div className="card-body items-center text-center">
            <p className="opacity-70">
              No payslips captured yet for {state.activeTaxYearId}. Add the
              first one to start building the assessment.
            </p>
          </div>
        </div>
      ) : null}

      {sorted.length > 0 ? (
        <div className="card border border-base-300 bg-base-100 shadow-sm">
          <div className="card-body">
            <h3 className="card-title text-base">Captured payslips</h3>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Employer</th>
                    <th className="text-right">Basic salary</th>
                    <th className="text-right">PAYE</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((slip) => (
                    <tr key={slip.id} className="hover:bg-base-200">
                      <td>{monthLabel.get(slip.periodMonth) ?? slip.periodMonth}</td>
                      <td>{slip.employer}</td>
                      <td className="currency text-right">
                        {formatRand(slip.basicSalary)}
                      </td>
                      <td className="currency text-right">
                        {formatRand(slip.paye)}
                      </td>
                      <td className="text-right">
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={() => setEditing(slip)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs text-error"
                          aria-label={`Remove payslip ${slip.employer} ${slip.periodMonth}`}
                          onClick={() =>
                            dispatch({ type: "removePayslip", id: slip.id })
                          }
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="mt-2 grid gap-3 sm:grid-cols-3">
              <div>
                <dt className="label-caps opacity-60">Gross payroll income</dt>
                <dd className="currency text-lg font-semibold">
                  {formatRand(totals.grossPayrollIncome)}
                </dd>
              </div>
              <div>
                <dt className="label-caps opacity-60">PAYE withheld</dt>
                <dd className="currency text-lg font-semibold">
                  {formatRand(totals.paye)}
                </dd>
              </div>
              <div>
                <dt className="label-caps opacity-60">Employers</dt>
                <dd className="text-lg font-semibold">
                  {totals.employers.length}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      ) : null}
    </div>
  );
}
