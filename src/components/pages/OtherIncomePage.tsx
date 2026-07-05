"use client";

import { useState } from "react";
import CurrencyField from "@/components/fields/CurrencyField";
import NamedAmountEditor from "@/components/fields/NamedAmountEditor";
import { formatRand } from "@/lib/format";
import {
  netCapitalGains,
  netFreelanceIncome,
  netRentalIncome,
} from "@/lib/model/aggregate";
import { emptyRental } from "@/lib/model/defaults";
import { newId } from "@/lib/model/ids";
import type { CapitalDisposal, RentalProperty } from "@/lib/model/types";
import { clampPercent, sanitizeLabel } from "@/lib/model/validate";
import { useActiveYear, useStore } from "@/lib/store/StoreProvider";
import { getTaxYear } from "@/lib/tax-engine/tax-tables";

function RentalForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: RentalProperty;
  onSave: (rental: RentalProperty) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<RentalProperty>(initial);

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
          {initial.name === "" ? "New rental property" : `Edit: ${initial.name}`}
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="form-control w-full">
            <span className="label-caps mb-1 block opacity-70">
              Property name
            </span>
            <input
              type="text"
              className="input input-bordered w-full"
              value={draft.name}
              required
              aria-label="Property name"
              onChange={(event) =>
                setDraft({ ...draft, name: sanitizeLabel(event.target.value) })
              }
            />
          </label>
          <CurrencyField
            label="Rental income for the year"
            value={draft.rentalIncome}
            onChange={(rentalIncome) => setDraft({ ...draft, rentalIncome })}
          />
          <label className="form-control w-full">
            <span className="label-caps mb-1 block opacity-70">
              Your share of the result (%)
            </span>
            <input
              type="number"
              min={0}
              max={100}
              step={0.01}
              className="input input-bordered w-full"
              value={draft.apportionmentPercent}
              aria-label="Your share of the result (%)"
              onChange={(event) =>
                setDraft({
                  ...draft,
                  apportionmentPercent: clampPercent(
                    Number.parseFloat(event.target.value),
                  ),
                })
              }
            />
            <span className="mt-1 block text-xs opacity-60">
              Covers shared ownership or partial-year letting
            </span>
          </label>
        </div>
        <NamedAmountEditor
          title="Deductible expenses"
          addLabel="Add expense"
          items={draft.expenses}
          onChange={(expenses) => setDraft({ ...draft, expenses })}
        />
        <div className="card-actions justify-end">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Save property
          </button>
        </div>
      </div>
    </form>
  );
}

function DisposalForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: CapitalDisposal;
  onSave: (disposal: CapitalDisposal) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<CapitalDisposal>(initial);
  return (
    <form
      className="card border border-base-300 bg-base-100 shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(draft);
      }}
    >
      <div className="card-body gap-4">
        <h3 className="card-title text-base">Capital disposal</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="form-control w-full sm:col-span-2">
            <span className="label-caps mb-1 block opacity-70">
              Description
            </span>
            <input
              type="text"
              className="input input-bordered w-full"
              value={draft.description}
              required
              aria-label="Disposal description"
              onChange={(event) =>
                setDraft({
                  ...draft,
                  description: sanitizeLabel(event.target.value),
                })
              }
            />
          </label>
          <CurrencyField
            label="Proceeds"
            value={draft.proceeds}
            onChange={(proceeds) => setDraft({ ...draft, proceeds })}
          />
          <CurrencyField
            label="Base cost"
            value={draft.baseCost}
            onChange={(baseCost) => setDraft({ ...draft, baseCost })}
          />
        </div>
        <label className="label cursor-pointer justify-start gap-3">
          <input
            type="checkbox"
            className="checkbox checkbox-primary"
            checked={draft.isPrimaryResidence}
            onChange={(event) =>
              setDraft({ ...draft, isPrimaryResidence: event.target.checked })
            }
          />
          <span>
            Primary residence (the per-disposal exclusion applies to the gain)
          </span>
        </label>
        <div className="card-actions justify-end">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Save disposal
          </button>
        </div>
      </div>
    </form>
  );
}

export default function OtherIncomePage() {
  const { state, dispatch } = useStore();
  const year = useActiveYear();
  const tables = getTaxYear(state.activeTaxYearId);
  const [editingRental, setEditingRental] = useState<RentalProperty | null>(
    null,
  );
  const [editingDisposal, setEditingDisposal] =
    useState<CapitalDisposal | null>(null);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Other income</h2>
        <p className="mt-1 text-sm opacity-70">
          Rental properties, freelance and side income, interest, dividends,
          and capital disposals for the {tables.label} year.
        </p>
      </div>

      <section className="space-y-4" aria-labelledby="rentals-heading">
        <div className="flex items-center justify-between">
          <h3 id="rentals-heading" className="text-lg font-semibold">
            Rental properties
          </h3>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => setEditingRental(emptyRental())}
          >
            Add property
          </button>
        </div>
        {editingRental ? (
          <RentalForm
            initial={editingRental}
            onCancel={() => setEditingRental(null)}
            onSave={(rental) => {
              dispatch({ type: "upsertRental", rental });
              setEditingRental(null);
            }}
          />
        ) : null}
        {year.rentals.length > 0 ? (
          <ul className="space-y-2">
            {year.rentals.map((rental) => (
              <li
                key={rental.id}
                className="flex items-center justify-between rounded-box border border-base-300 bg-base-100 px-4 py-3"
              >
                <div>
                  <p className="font-medium">{rental.name}</p>
                  <p className="text-sm opacity-60">
                    {rental.expenses.length} expense line
                    {rental.expenses.length === 1 ? "" : "s"},{" "}
                    {rental.apportionmentPercent}% share
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="currency">
                    {formatRand(netRentalIncome([rental]))}
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={() => setEditingRental(rental)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs text-error"
                    aria-label={`Remove rental ${rental.name}`}
                    onClick={() =>
                      dispatch({ type: "removeRental", id: rental.id })
                    }
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm opacity-60">No rental properties captured.</p>
        )}
        {year.rentals.length > 0 ? (
          <p className="text-sm">
            Net rental income:{" "}
            <span className="currency font-semibold">
              {formatRand(netRentalIncome(year.rentals))}
            </span>
          </p>
        ) : null}
      </section>

      <section className="space-y-4" aria-labelledby="freelance-heading">
        <div className="flex items-center justify-between">
          <h3 id="freelance-heading" className="text-lg font-semibold">
            Freelance and side income
          </h3>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() =>
              dispatch({
                type: "upsertFreelance",
                item: { id: newId(), description: "", income: 0, expenses: 0 },
              })
            }
          >
            Add item
          </button>
        </div>
        {year.freelance.length > 0 ? (
          <ul className="space-y-3">
            {year.freelance.map((item) => (
              <li
                key={item.id}
                className="grid items-end gap-3 rounded-box border border-base-300 bg-base-100 p-4 sm:grid-cols-[1fr_auto_auto_auto]"
              >
                <label className="form-control">
                  <span className="label-caps mb-1 block opacity-70">
                    Description
                  </span>
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    value={item.description}
                    aria-label="Freelance description"
                    onChange={(event) =>
                      dispatch({
                        type: "upsertFreelance",
                        item: {
                          ...item,
                          description: sanitizeLabel(event.target.value),
                        },
                      })
                    }
                  />
                </label>
                <div className="w-40">
                  <CurrencyField
                    label="Income"
                    value={item.income}
                    onChange={(income) =>
                      dispatch({
                        type: "upsertFreelance",
                        item: { ...item, income },
                      })
                    }
                  />
                </div>
                <div className="w-40">
                  <CurrencyField
                    label="Expenses"
                    value={item.expenses}
                    onChange={(expenses) =>
                      dispatch({
                        type: "upsertFreelance",
                        item: { ...item, expenses },
                      })
                    }
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm text-error"
                  aria-label={`Remove freelance item ${item.description}`}
                  onClick={() =>
                    dispatch({ type: "removeFreelance", id: item.id })
                  }
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm opacity-60">
            No freelance or side income captured.
          </p>
        )}
        {year.freelance.length > 0 ? (
          <p className="text-sm">
            Net freelance income:{" "}
            <span className="currency font-semibold">
              {formatRand(netFreelanceIncome(year.freelance))}
            </span>
          </p>
        ) : null}
      </section>

      <section className="space-y-4" aria-labelledby="investment-heading">
        <h3 id="investment-heading" className="text-lg font-semibold">
          Interest and dividends
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <CurrencyField
            label="Local interest received"
            value={year.localInterest}
            onChange={(amount) =>
              dispatch({ type: "setLocalInterest", amount })
            }
            hint="SARS code 4201. The age-based exemption applies automatically."
          />
          <CurrencyField
            label="Local dividends received"
            value={year.localDividends}
            onChange={(amount) =>
              dispatch({ type: "setLocalDividends", amount })
            }
            hint="Informational. Dividends tax is withheld at source."
          />
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="disposals-heading">
        <div className="flex items-center justify-between">
          <h3 id="disposals-heading" className="text-lg font-semibold">
            Capital disposals
          </h3>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() =>
              setEditingDisposal({
                id: newId(),
                description: "",
                proceeds: 0,
                baseCost: 0,
                isPrimaryResidence: false,
              })
            }
          >
            Add disposal
          </button>
        </div>
        {editingDisposal ? (
          <DisposalForm
            initial={editingDisposal}
            onCancel={() => setEditingDisposal(null)}
            onSave={(disposal) => {
              dispatch({ type: "upsertDisposal", disposal });
              setEditingDisposal(null);
            }}
          />
        ) : null}
        {year.disposals.length > 0 ? (
          <ul className="space-y-2">
            {year.disposals.map((disposal) => (
              <li
                key={disposal.id}
                className="flex items-center justify-between rounded-box border border-base-300 bg-base-100 px-4 py-3"
              >
                <div>
                  <p className="font-medium">{disposal.description}</p>
                  <p className="text-sm opacity-60">
                    {disposal.isPrimaryResidence
                      ? "Primary residence"
                      : "Other asset"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="currency">
                    {formatRand(disposal.proceeds - disposal.baseCost)}
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={() => setEditingDisposal(disposal)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs text-error"
                    aria-label={`Remove disposal ${disposal.description}`}
                    onClick={() =>
                      dispatch({ type: "removeDisposal", id: disposal.id })
                    }
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm opacity-60">No disposals captured.</p>
        )}
        {year.disposals.length > 0 ? (
          <p className="text-sm">
            Net capital gains after per-disposal exclusions:{" "}
            <span className="currency font-semibold">
              {formatRand(netCapitalGains(year.disposals, tables))}
            </span>
          </p>
        ) : null}
      </section>
    </div>
  );
}
