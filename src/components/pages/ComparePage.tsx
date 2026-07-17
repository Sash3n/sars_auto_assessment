"use client";

import { useMemo, useState } from "react";
import CurrencyField from "@/components/fields/CurrencyField";
import { parseIta34Text, type ParsedIta34 } from "@/lib/extraction/ita34";
import { formatRand } from "@/lib/format";
import { useActiveYear } from "@/lib/store/StoreProvider";
import { composeAssessment } from "@/lib/tax-engine/assessment";
import {
  compareAssessments,
  type ComparisonRow,
} from "@/lib/tax-engine/compare";
import { getTaxYear } from "@/lib/tax-engine/tax-tables";
import { buildAssessmentTrace, type TraceStep } from "@/lib/tax-engine/trace";

/*
 * Not every comparison row maps to a single trace step: coded lines like
 * retirement (4029) map directly, while summary rows like "Assessed tax
 * after rebates" are the sum of several steps (tax, rebates, both medical
 * credits). Mapping is by row identity, not automatic, since compare.ts's
 * rows and trace.ts's steps are independently shaped.
 */
function traceForRow(row: ComparisonRow, trace: TraceStep[]): TraceStep[] {
  if (row.code === "4029") {
    return trace.filter((step) => step.code === "4029");
  }
  if (row.key === "assessedTaxAfterRebates") {
    return trace.filter((step) =>
      [
        "brackets.taxBeforeRebates",
        "rebates.totalRebates",
        "medical.annualMedicalSchemeCredit",
        "medical.additionalMedicalCredit",
      ].includes(step.section),
    );
  }
  return [];
}

function WhyRow({ steps }: { steps: TraceStep[] }) {
  const [expanded, setExpanded] = useState(false);
  if (steps.length === 0) {
    return null;
  }
  return (
    <>
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="text-xs font-normal text-primary underline"
      >
        {expanded ? "Hide working" : "Why?"}
      </button>
      {expanded ? (
        <div className="mt-1 space-y-1 text-xs opacity-80">
          {steps.map((step) => (
            <p key={step.section}>{step.label}: {step.formula}</p>
          ))}
        </div>
      ) : null}
    </>
  );
}

function StatusBadge({ status }: { status: ComparisonRow["status"] }) {
  if (status === "match") {
    return <span className="badge badge-success badge-sm rounded-full">match</span>;
  }
  if (status === "mismatch") {
    return <span className="badge badge-error badge-sm rounded-full">mismatch</span>;
  }
  return (
    <span className="badge badge-ghost badge-sm rounded-full">
      not available
    </span>
  );
}

export default function ComparePage() {
  const year = useActiveYear();
  const tables = getTaxYear(year.taxYearId);
  const assessment = useMemo(
    () => composeAssessment(year, tables),
    [year, tables],
  );
  const trace = useMemo(
    () => buildAssessmentTrace(year, tables),
    [year, tables],
  );
  const [pasted, setPasted] = useState("");
  const [parsed, setParsed] = useState<ParsedIta34 | null>(null);
  const [threshold, setThreshold] = useState(5);
  const [overrides, setOverrides] = useState<Record<string, number>>({});

  const effectiveSars: ParsedIta34 | null = useMemo(() => {
    if (!parsed) {
      return null;
    }
    const merged: ParsedIta34 = {
      codes: { ...parsed.codes },
      summary: { ...parsed.summary },
      warnings: parsed.warnings,
    };
    for (const [key, amount] of Object.entries(overrides)) {
      if (key.startsWith("code:")) {
        merged.codes[key.slice(5)] = amount;
      } else {
        merged.summary[key as keyof ParsedIta34["summary"]] = amount;
      }
    }
    return merged;
  }, [parsed, overrides]);

  const rows = useMemo(
    () =>
      effectiveSars
        ? compareAssessments(assessment, effectiveSars, threshold)
        : [],
    [assessment, effectiveSars, threshold],
  );

  // The manual input stays visible while the user types: visibility keys
  // off the original parse, not the merged value, otherwise the field
  // would vanish after the first digit.
  function originallyMissing(row: ComparisonRow): boolean {
    if (!parsed) {
      return false;
    }
    if (row.code) {
      return !(row.code in parsed.codes);
    }
    return (
      row.key !== undefined &&
      parsed.summary[row.key as keyof ParsedIta34["summary"]] === undefined
    );
  }

  const mismatches = rows.filter((row) => row.status === "mismatch").length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Compare with SARS
        </h2>
        <p className="mt-1 text-sm opacity-70">
          Paste the text of your SARS auto-assessment (ITA34) below. Each
          line is diffed against your calculated {tables.label} assessment,
          by SARS code. Figures that cannot be read show as not available and
          can be filled in manually, they are never assumed to be zero.
        </p>
      </div>

      <section className="card border border-base-300 bg-base-100 shadow-sm">
        <div className="card-body">
          <h3 className="card-title text-base">Paste the ITA34 text</h3>
          <textarea
            className="textarea textarea-bordered min-h-32 w-full font-mono text-sm"
            placeholder="Paste the ITA34 export or copied text here"
            aria-label="Pasted ITA34 text"
            value={pasted}
            onChange={(event) => setPasted(event.target.value)}
          />
          <div className="card-actions items-end justify-between">
            <label className="form-control">
              <span className="label-caps mb-1 block opacity-70">
                Mismatch threshold (rand)
              </span>
              <input
                type="number"
                min={0}
                step={1}
                className="input input-bordered input-sm w-36"
                value={threshold}
                aria-label="Mismatch threshold in rand"
                onChange={(event) => {
                  const value = Number.parseFloat(event.target.value);
                  setThreshold(Number.isFinite(value) && value >= 0 ? value : 0);
                }}
              />
            </label>
            <button
              type="button"
              className="btn btn-primary"
              disabled={pasted.trim() === ""}
              onClick={() => {
                setOverrides({});
                setParsed(parseIta34Text(pasted));
              }}
            >
              Compare
            </button>
          </div>
        </div>
      </section>

      {parsed?.warnings.map((warning) => (
        <div key={warning} role="alert" className="alert alert-warning">
          <span>{warning}</span>
        </div>
      ))}

      {effectiveSars && rows.length > 0 ? (
        <section className="card border border-base-300 bg-base-100 shadow-sm">
          <div className="card-body">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="card-title text-base">Line-by-line comparison</h3>
              <span
                className={`badge rounded-full ${
                  mismatches === 0 ? "badge-success" : "badge-error"
                }`}
              >
                {mismatches === 0
                  ? "No mismatches above the threshold"
                  : `${mismatches} mismatch${mismatches === 1 ? "" : "es"}`}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Line</th>
                    <th className="text-right">Your calculation</th>
                    <th className="text-right">SARS assessment</th>
                    <th className="text-right">Delta</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.code ?? row.key ?? row.description}
                      className={
                        row.status === "mismatch"
                          ? "bg-error/10"
                          : "hover:bg-base-200"
                      }
                    >
                      <td className="font-mono text-xs opacity-60">
                        {row.code ?? ""}
                      </td>
                      <td>
                        {row.description}
                        {row.status === "mismatch" ? (
                          <div>
                            <WhyRow steps={traceForRow(row, trace)} />
                          </div>
                        ) : null}
                      </td>
                      <td className="currency text-right">
                        {row.mineAmount === null
                          ? "not calculated"
                          : formatRand(row.mineAmount)}
                      </td>
                      <td className="currency text-right">
                        {originallyMissing(row) ? (
                          <div className="flex justify-end">
                            <div className="w-44">
                              <CurrencyField
                                label={`SARS value for ${row.description}`}
                                value={
                                  overrides[
                                    row.code ? `code:${row.code}` : row.key!
                                  ] ?? 0
                                }
                                onChange={(amount) =>
                                  setOverrides((current) => ({
                                    ...current,
                                    [row.code ? `code:${row.code}` : row.key!]:
                                      amount,
                                  }))
                                }
                              />
                            </div>
                          </div>
                        ) : row.sarsAmount === null ? (
                          ""
                        ) : (
                          formatRand(row.sarsAmount)
                        )}
                      </td>
                      <td className="currency text-right">
                        {row.delta === null ? "" : formatRand(row.delta)}
                      </td>
                      <td>
                        <StatusBadge status={row.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs opacity-60">
              A positive delta means your calculation is higher than the SARS
              assessment for that line. Mismatches above R{" "}
              {threshold.toFixed(0)} are flagged. If SARS assessed you
              incorrectly, discrepancies can be disputed inside the
              40-business-day correction window.
            </p>
          </div>
        </section>
      ) : null}
    </div>
  );
}
