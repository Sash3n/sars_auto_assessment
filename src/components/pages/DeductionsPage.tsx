"use client";

import Link from "next/link";
import CurrencyField from "@/components/fields/CurrencyField";
import NamedAmountEditor from "@/components/fields/NamedAmountEditor";
import StickyActionBar from "@/components/ui/StickyActionBar";
import Stepper from "@/components/ui/Stepper";
import { formatRand } from "@/lib/format";
import { emptyDependent } from "@/lib/model/defaults";
import type { Dependent, DependentRelationship } from "@/lib/model/types";
import { clampMonths, isIsoDate } from "@/lib/model/validate";
import { useActiveYear, useStore } from "@/lib/store/StoreProvider";
import { composeAssessment } from "@/lib/tax-engine/assessment";
import { homeOfficeDeduction } from "@/lib/tax-engine/home-office";
import { getTaxYear } from "@/lib/tax-engine/tax-tables";
import { travelDeduction } from "@/lib/tax-engine/travel";

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
  const tables = getTaxYear(year.taxYearId);
  const assessment = composeAssessment(year, tables);
  const hasData = assessment.incomeTotal > 0;
  const refund = assessment.netAmount < 0;
  const travel = year.travel;
  const travelResult = travelDeduction(travel, tables);
  const homeOffice = homeOfficeDeduction({
    directExpenses: profile.homeOfficeExpenses,
    runningCosts: profile.homeOfficeRunningCosts,
    officeAreaM2: profile.homeOfficeAreaM2,
    homeAreaM2: profile.homeTotalAreaM2,
  });

  return (
    <div className="space-y-8 pb-16 lg:pb-0">
      <Stepper activeIndex={3} />
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Deductions and household
        </h2>
        <p className="mt-1 text-sm opacity-70">
          Your details drive rebates and age-based exemptions. Dependents
          drive the medical scheme fees credit.
        </p>
      </div>

      {hasData ? (
        <section
          className="card border border-base-300 bg-base-200/50"
          aria-labelledby="impact-heading"
        >
          <div className="card-body flex-row flex-wrap items-center gap-x-8 gap-y-2 py-4">
            <h3 id="impact-heading" className="label-caps w-full opacity-70">
              Estimated impact as you capture
            </h3>
            <div>
              <p className="label-caps opacity-60">Deductions allowed</p>
              <p className="currency font-semibold">
                {formatRand(assessment.deductionsTotal)}
              </p>
            </div>
            <div>
              <p className="label-caps opacity-60">Taxable income</p>
              <p className="currency font-semibold">
                {formatRand(assessment.taxableIncome)}
              </p>
            </div>
            <div>
              <p className="label-caps opacity-60">Estimated result</p>
              <p
                className={`currency font-semibold ${
                  refund ? "text-primary" : "text-error"
                }`}
              >
                {refund
                  ? `${formatRand(Math.abs(assessment.netAmount))} refund`
                  : `${formatRand(assessment.netAmount)} owed`}
              </p>
            </div>
          </div>
        </section>
      ) : null}

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
              label="Donations without individual certificates"
              value={profile.donations}
              onChange={(donations) =>
                dispatch({ type: "updateProfile", patch: { donations } })
              }
              hint="Section 18A. Capture receipted certificates individually below."
            />
          </div>
          <NamedAmountEditor
            title="Donation certificates (section 18A)"
            addLabel="Add certificate"
            items={profile.donationCertificates}
            onChange={(donationCertificates) =>
              dispatch({
                type: "updateProfile",
                patch: { donationCertificates },
              })
            }
          />
          <p className="text-xs opacity-60">
            SARS caps the section 18A deduction at 10 percent of taxable
            income; any excess carries forward to next year. The calculation
            applies the cap automatically.
          </p>
        </div>
      </section>

      <section
        className="card border border-base-300 bg-base-100 shadow-sm"
        aria-labelledby="home-office-heading"
      >
        <div className="card-body gap-4">
          <h3 id="home-office-heading" className="card-title text-base">
            Home office
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="form-control w-full">
              <span className="label-caps mb-1 block opacity-70">
                Office area (m²)
              </span>
              <input
                type="number"
                min={0}
                step={0.1}
                className="input input-bordered w-full"
                value={profile.homeOfficeAreaM2 || ""}
                placeholder="0"
                aria-label="Office area in square metres"
                onChange={(event) => {
                  const value = Number.parseFloat(event.target.value);
                  dispatch({
                    type: "updateProfile",
                    patch: {
                      homeOfficeAreaM2:
                        Number.isFinite(value) && value >= 0 ? value : 0,
                    },
                  });
                }}
              />
            </label>
            <label className="form-control w-full">
              <span className="label-caps mb-1 block opacity-70">
                Total home area (m²)
              </span>
              <input
                type="number"
                min={0}
                step={0.1}
                className="input input-bordered w-full"
                value={profile.homeTotalAreaM2 || ""}
                placeholder="0"
                aria-label="Total home area in square metres"
                onChange={(event) => {
                  const value = Number.parseFloat(event.target.value);
                  dispatch({
                    type: "updateProfile",
                    patch: {
                      homeTotalAreaM2:
                        Number.isFinite(value) && value >= 0 ? value : 0,
                    },
                  });
                }}
              />
            </label>
            <CurrencyField
              label="Annual home running costs"
              value={profile.homeOfficeRunningCosts}
              onChange={(homeOfficeRunningCosts) =>
                dispatch({
                  type: "updateProfile",
                  patch: { homeOfficeRunningCosts },
                })
              }
              hint="Rent or bond interest, rates, electricity, cleaning. Apportioned by floor area."
            />
            <CurrencyField
              label="Direct office expenses"
              value={profile.homeOfficeExpenses}
              onChange={(homeOfficeExpenses) =>
                dispatch({
                  type: "updateProfile",
                  patch: { homeOfficeExpenses },
                })
              }
              hint="Costs for the office itself, claimed in full"
            />
          </div>
          <p className="text-sm">
            Calculated office share:{" "}
            <span className="currency font-semibold">
              {homeOffice.percent.toFixed(2)}%
            </span>{" "}
            of the home. Home office deduction:{" "}
            <span className="currency font-semibold">
              {formatRand(homeOffice.total)}
            </span>
          </p>
          <p className="text-xs opacity-60">
            SARS only allows a home office claim if the space is used
            regularly and exclusively for work and, for employees, if the
            employer permits remote work for more than half the year.
          </p>
        </div>
      </section>

      <section
        className="card border border-base-300 bg-base-100 shadow-sm"
        aria-labelledby="travel-heading"
      >
        <div className="card-body gap-4">
          <h3 id="travel-heading" className="card-title text-base">
            Travel allowance (logbook)
          </h3>
          <p className="text-sm opacity-70">
            If you receive a travel allowance, the deemed cost deduction is
            claimed against it using your logbook kilometres and the SARS
            cost scale for {tables.label}. Capture the allowance itself as a
            payslip allowance under Income.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <CurrencyField
              label="Travel allowance received for the year"
              value={travel.allowanceReceived}
              onChange={(allowanceReceived) =>
                dispatch({ type: "updateTravel", patch: { allowanceReceived } })
              }
              hint="IRP5 code 3701"
            />
            <CurrencyField
              label="Vehicle value"
              value={travel.vehicleValue}
              onChange={(vehicleValue) =>
                dispatch({ type: "updateTravel", patch: { vehicleValue } })
              }
              hint="Cost including VAT, excluding finance charges"
            />
            <label className="form-control w-full">
              <span className="label-caps mb-1 block opacity-70">
                Total kilometres for the year
              </span>
              <input
                type="number"
                min={0}
                className="input input-bordered w-full"
                value={travel.totalKm || ""}
                placeholder="0"
                aria-label="Total kilometres for the year"
                onChange={(event) => {
                  const value = Number.parseFloat(event.target.value);
                  dispatch({
                    type: "updateTravel",
                    patch: {
                      totalKm: Number.isFinite(value) && value >= 0 ? value : 0,
                    },
                  });
                }}
              />
            </label>
            <label className="form-control w-full">
              <span className="label-caps mb-1 block opacity-70">
                Business kilometres (logbook)
              </span>
              <input
                type="number"
                min={0}
                className="input input-bordered w-full"
                value={travel.businessKm || ""}
                placeholder="0"
                aria-label="Business kilometres from the logbook"
                onChange={(event) => {
                  const value = Number.parseFloat(event.target.value);
                  dispatch({
                    type: "updateTravel",
                    patch: {
                      businessKm:
                        Number.isFinite(value) && value >= 0 ? value : 0,
                    },
                  });
                }}
              />
            </label>
            <label className="label cursor-pointer justify-start gap-3">
              <input
                type="checkbox"
                className="checkbox checkbox-primary checkbox-sm"
                checked={travel.paidFullFuel}
                aria-label="I paid the full fuel cost"
                onChange={(event) =>
                  dispatch({
                    type: "updateTravel",
                    patch: { paidFullFuel: event.target.checked },
                  })
                }
              />
              <span className="text-sm">I paid the full fuel cost</span>
            </label>
            <label className="label cursor-pointer justify-start gap-3">
              <input
                type="checkbox"
                className="checkbox checkbox-primary checkbox-sm"
                checked={travel.paidFullMaintenance}
                aria-label="I paid the full maintenance cost"
                onChange={(event) =>
                  dispatch({
                    type: "updateTravel",
                    patch: { paidFullMaintenance: event.target.checked },
                  })
                }
              />
              <span className="text-sm">
                I paid the full maintenance cost (no maintenance plan)
              </span>
            </label>
          </div>
          {travelResult.allowed > 0 ? (
            <p className="text-sm">
              Deemed rate:{" "}
              <span className="currency font-semibold">
                R {travelResult.ratePerKm.toFixed(2)}/km
              </span>
              . Travel deduction:{" "}
              <span className="currency font-semibold">
                {formatRand(travelResult.allowed)}
              </span>
              {travelResult.deemedCost > travelResult.allowed
                ? " (capped at the allowance received)"
                : null}
            </p>
          ) : (
            <p className="text-xs opacity-60">
              A logbook with total and business kilometres, the vehicle
              value, and the allowance received are all needed before a
              deduction is claimed. SARS requires the logbook to be kept for
              five years.
            </p>
          )}
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

      {hasData ? (
        <StickyActionBar>
          <span className="text-sm">
            {refund ? "Refund: " : "Owed: "}
            <span
              className={`currency font-semibold ${
                refund ? "text-primary" : "text-error"
              }`}
            >
              {formatRand(Math.abs(assessment.netAmount))}
            </span>
          </span>
          <Link href="/results" className="btn btn-primary btn-sm">
            View results
          </Link>
        </StickyActionBar>
      ) : null}
    </div>
  );
}
