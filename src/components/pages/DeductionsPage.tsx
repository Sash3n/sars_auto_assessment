"use client";

import CurrencyField from "@/components/fields/CurrencyField";
import { emptyDependent } from "@/lib/model/defaults";
import type { Dependent, DependentRelationship } from "@/lib/model/types";
import { clampMonths, isIsoDate } from "@/lib/model/validate";
import { useActiveYear, useStore } from "@/lib/store/StoreProvider";

const RELATIONSHIPS: { value: DependentRelationship; label: string }[] = [
  { value: "spouse", label: "Spouse" },
  { value: "child", label: "Child" },
  { value: "parent", label: "Parent" },
  { value: "other", label: "Other" },
];

function DependentRow({
  dependent,
  onChange,
  onRemove,
}: {
  dependent: Dependent;
  onChange: (dependent: Dependent) => void;
  onRemove: () => void;
}) {
  return (
    <li className="grid items-end gap-3 rounded-box border border-base-300 bg-base-100 p-4 lg:grid-cols-[auto_auto_auto_auto_auto]">
      <label className="form-control">
        <span className="label-caps mb-1 block opacity-70">Relationship</span>
        <select
          className="select select-bordered"
          value={dependent.relationship}
          aria-label="Relationship"
          onChange={(event) =>
            onChange({
              ...dependent,
              relationship: event.target.value as DependentRelationship,
            })
          }
        >
          {RELATIONSHIPS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="form-control">
        <span className="label-caps mb-1 block opacity-70">Date of birth</span>
        <input
          type="date"
          className="input input-bordered"
          value={dependent.dateOfBirth}
          aria-label="Dependent date of birth"
          onChange={(event) => {
            const value = event.target.value;
            if (value === "" || isIsoDate(value)) {
              onChange({ ...dependent, dateOfBirth: value });
            }
          }}
        />
      </label>
      <label className="form-control">
        <span className="label-caps mb-1 block opacity-70">
          Months on scheme
        </span>
        <input
          type="number"
          min={0}
          max={12}
          className="input input-bordered w-28"
          value={dependent.medicalSchemeMonths}
          aria-label="Months on medical scheme"
          onChange={(event) =>
            onChange({
              ...dependent,
              medicalSchemeMonths: clampMonths(
                Number.parseInt(event.target.value, 10),
              ),
            })
          }
        />
      </label>
      <label className="label cursor-pointer justify-start gap-2">
        <input
          type="checkbox"
          className="checkbox checkbox-primary checkbox-sm"
          checked={dependent.hasDisability}
          aria-label="Dependent has a disability"
          onChange={(event) =>
            onChange({ ...dependent, hasDisability: event.target.checked })
          }
        />
        <span className="text-sm">Disability</span>
      </label>
      <button
        type="button"
        className="btn btn-ghost btn-sm text-error"
        aria-label="Remove dependent"
        onClick={onRemove}
      >
        Remove
      </button>
    </li>
  );
}

export default function DeductionsPage() {
  const { dispatch } = useStore();
  const year = useActiveYear();
  const { profile } = year;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Deductions and household
        </h2>
        <p className="mt-1 text-sm opacity-70">
          Your details drive rebates and age-based exemptions. Dependents
          drive the medical scheme fees credit.
        </p>
      </div>

      <section
        className="card border border-base-300 bg-base-100 shadow-sm"
        aria-labelledby="profile-heading"
      >
        <div className="card-body gap-4">
          <h3 id="profile-heading" className="card-title text-base">
            Taxpayer details
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="form-control w-full">
              <span className="label-caps mb-1 block opacity-70">
                Date of birth
              </span>
              <input
                type="date"
                className="input input-bordered w-full"
                value={profile.dateOfBirth}
                aria-label="Date of birth"
                onChange={(event) => {
                  const value = event.target.value;
                  if (value === "" || isIsoDate(value)) {
                    dispatch({
                      type: "updateProfile",
                      patch: { dateOfBirth: value },
                    });
                  }
                }}
              />
              <span className="mt-1 block text-xs opacity-60">
                Sets the rebate age band and interest exemption
              </span>
            </label>
            <label className="form-control w-full">
              <span className="label-caps mb-1 block opacity-70">
                Months as medical scheme main member
              </span>
              <input
                type="number"
                min={0}
                max={12}
                className="input input-bordered w-full"
                value={profile.medicalSchemeMonths}
                aria-label="Months as medical scheme main member"
                onChange={(event) =>
                  dispatch({
                    type: "updateProfile",
                    patch: {
                      medicalSchemeMonths: clampMonths(
                        Number.parseInt(event.target.value, 10),
                      ),
                    },
                  })
                }
              />
            </label>
            <label className="label cursor-pointer justify-start gap-3 sm:col-span-2">
              <input
                type="checkbox"
                className="checkbox checkbox-primary"
                checked={profile.hasDisability}
                aria-label="Taxpayer has a disability"
                onChange={(event) =>
                  dispatch({
                    type: "updateProfile",
                    patch: { hasDisability: event.target.checked },
                  })
                }
              />
              <span>
                I or a member of my household have a SARS-recognised
                disability (changes the section 6B formula)
              </span>
            </label>
          </div>
        </div>
      </section>

      <section
        className="card border border-base-300 bg-base-100 shadow-sm"
        aria-labelledby="medical-heading"
      >
        <div className="card-body gap-4">
          <h3 id="medical-heading" className="card-title text-base">
            Medical costs paid personally
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <CurrencyField
              label="Private medical scheme contributions"
              value={profile.privateMedicalContributions}
              onChange={(privateMedicalContributions) =>
                dispatch({
                  type: "updateProfile",
                  patch: { privateMedicalContributions },
                })
              }
              hint="Contributions paid outside payroll"
            />
            <CurrencyField
              label="Qualifying out-of-pocket medical expenses"
              value={profile.qualifyingMedicalExpenses}
              onChange={(qualifyingMedicalExpenses) =>
                dispatch({
                  type: "updateProfile",
                  patch: { qualifyingMedicalExpenses },
                })
              }
            />
          </div>
        </div>
      </section>

      <section
        className="card border border-base-300 bg-base-100 shadow-sm"
        aria-labelledby="other-deductions-heading"
      >
        <div className="card-body gap-4">
          <h3 id="other-deductions-heading" className="card-title text-base">
            Other deductions
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <CurrencyField
              label="Private retirement annuity contributions"
              value={profile.privateRetirementContributions}
              onChange={(privateRetirementContributions) =>
                dispatch({
                  type: "updateProfile",
                  patch: { privateRetirementContributions },
                })
              }
              hint="Not on any payslip. Payroll contributions are captured per payslip."
            />
            <CurrencyField
              label="Retirement excess carried forward"
              value={year.carryForward.retirementExcessPrior}
              onChange={(amount) =>
                dispatch({ type: "setRetirementExcessPrior", amount })
              }
              hint="Contributions disallowed in prior years"
            />
            <CurrencyField
              label="Section 18A donations"
              value={profile.donations}
              onChange={(donations) =>
                dispatch({ type: "updateProfile", patch: { donations } })
              }
            />
            <CurrencyField
              label="Home office expenses"
              value={profile.homeOfficeExpenses}
              onChange={(homeOfficeExpenses) =>
                dispatch({
                  type: "updateProfile",
                  patch: { homeOfficeExpenses },
                })
              }
            />
          </div>
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="dependents-heading">
        <div className="flex items-center justify-between">
          <h3 id="dependents-heading" className="text-lg font-semibold">
            Dependents
          </h3>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() =>
              dispatch({ type: "upsertDependent", dependent: emptyDependent() })
            }
          >
            Add dependent
          </button>
        </div>
        {year.dependents.length > 0 ? (
          <ul className="space-y-3">
            {year.dependents.map((dependent) => (
              <DependentRow
                key={dependent.id}
                dependent={dependent}
                onChange={(updated) =>
                  dispatch({ type: "upsertDependent", dependent: updated })
                }
                onRemove={() =>
                  dispatch({ type: "removeDependent", id: dependent.id })
                }
              />
            ))}
          </ul>
        ) : (
          <p className="text-sm opacity-60">
            No dependents captured. Each dependent is a full record
            (relationship, date of birth, disability, scheme cover), so the
            medical credit is calculated correctly.
          </p>
        )}
      </section>
    </div>
  );
}
