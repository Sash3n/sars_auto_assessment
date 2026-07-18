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
import {
  buildObjectionSummary,
  formatObjectionSummaryText,
} from "@/lib/tax-engine/objection";
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

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

const statusIconProps = {
  width: 14,
  height: 14,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function StatusIndicator({ status }: { status: ComparisonRow["status"] }) {
  if (status === "match") {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-success">
        <svg {...statusIconProps} aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="m8.5 12.5 2.5 2.5 4.5-5" />
        </svg>
        match
      </span>
    );
  }
  if (status === "mismatch") {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-error">
        <svg {...statusIconProps} aria-hidden="true">
          <path d="M12 3 2.5 20h19Z" />
          <path d="M12 9v5m0 3h.01" />
        </svg>
        mismatch
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs font-medium opacity-60">
      <svg {...statusIconProps} aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5m0-8h.01" />
      </svg>
      not available
    </span>
  );
}

type RowGroup = "income" | "deductions" | "summary";

const GROUP_TITLES: Record<RowGroup, string> = {
  income: "Income",
  deductions: "Deductions and allowances",
  summary: "Tax liability and result",
};

function groupFor(row: ComparisonRow): RowGroup {
  if (row.key) {
    return "summary";
  }
  if (row.code?.startsWith("40")) {
    return "deductions";
  }
  return "income";
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
  const covered = rows.filter((row) => row.sarsAmount !== null).length;
  const finalRow = rows.find((row) => row.key === "assessmentResult");
  const finalDelta =
    finalRow && finalRow.mineAmount !== null && finalRow.sarsAmount !== null
      ? finalRow.mineAmount - finalRow.sarsAmount
      : null;
  const grouped = useMemo(() => {
    const groups: Record<RowGroup, ComparisonRow[]> = {
      income: [],
      deductions: [],
      summary: [],
    };
    for (const row of rows) {
      groups[groupFor(row)].push(row);
    }
    return groups;
  }, [rows]);
  const objectionLines = useMemo(() => buildObjectionSummary(rows), [rows]);
  const objectionText = useMemo(
    () => formatObjectionSummaryText(objectionLines, tables.label),
    [objectionLines, tables.label],
  );

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
          <div className="card-actions flex-col items-stretch justify-between sm:flex-row sm:items-end">
            <label className="form-control">
              <span className="label-caps mb-1 block opacity-70">
                Mismatch threshold (rand)
              </span>
              <input
                type="number"
                min={0}
                step={1}
                className="input input-bordered input-sm w-full sm:w-36"
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
              className="btn btn-primary w-full sm:w-auto"
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
        <>
          {finalDelta !== null && finalRow ? (
            <section
              className={`card border shadow-sm ${
                Math.abs(finalDelta) <= threshold
                  ? "border-primary/40 bg-primary/10"
                  : "border-warning/60 bg-warning/10"
              }`}
            >
              <div className="card-body">
                <p className="label-caps opacity-70">Final outcome difference</p>
                <p className="currency text-2xl font-semibold">
                  {Math.abs(finalDelta) <= threshold
                    ? "Your estimate matches the SARS assessment"
                    : finalDelta < 0
                      ? `Your estimate is ${formatRand(Math.abs(finalDelta))} more in your favour`
                      : `The SARS assessment is ${formatRand(finalDelta)} more in your favour`}
                </p>
                <dl className="mt-2 grid gap-4 sm:grid-cols-3">
                  <div>
                    <dt className="label-caps opacity-60">Your result</dt>
                    <dd className="currency font-semibold">
                      {formatRand(finalRow.mineAmount ?? 0)}
                    </dd>
                  </div>
                  <div>
                    <dt className="label-caps opacity-60">SARS result</dt>
                    <dd className="currency font-semibold">
                      {formatRand(finalRow.sarsAmount ?? 0)}
                    </dd>
                  </div>
                  <div>
                    <dt className="label-caps opacity-60">Variance</dt>
                    <dd className="currency font-semibold">
                      {formatRand(finalDelta)}
                    </dd>
                  </div>
                </dl>
                {finalDelta > threshold ? (
                  <p className="text-xs opacity-70">
                    A SARS result more favourable than your estimate is not
                    necessarily wrong. Check the line differences below
                    before deciding anything.
                  </p>
                ) : null}
              </div>
            </section>
          ) : null}

          <section className="card border border-base-300 bg-base-100 shadow-sm">
            <div className="card-body">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="card-title text-base">
                  Line-by-line comparison
                </h3>
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
              <div className="flex flex-wrap items-center gap-4 text-xs opacity-80">
                <StatusIndicator status="match" />
                <StatusIndicator status="mismatch" />
                <StatusIndicator status="not-available" />
                <span className="opacity-70">
                  {covered} of {rows.length} lines have a SARS figure
                </span>
              </div>

              <div className="hidden overflow-x-auto sm:block">
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
                    {(
                      ["income", "deductions", "summary"] as RowGroup[]
                    ).flatMap((group) =>
                      grouped[group].length === 0
                        ? []
                        : [
                            <tr key={`head-${group}`}>
                              <th
                                colSpan={6}
                                className="label-caps bg-base-200/60 opacity-70"
                              >
                                {GROUP_TITLES[group]}
                              </th>
                            </tr>,
                            ...grouped[group].map((row) => (
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
                                      <WhyRow
                                        steps={traceForRow(row, trace)}
                                      />
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
                                              row.code
                                                ? `code:${row.code}`
                                                : row.key!
                                            ] ?? 0
                                          }
                                          onChange={(amount) =>
                                            setOverrides((current) => ({
                                              ...current,
                                              [row.code
                                                ? `code:${row.code}`
                                                : row.key!]: amount,
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
                                  {row.delta === null
                                    ? ""
                                    : formatRand(row.delta)}
                                </td>
                                <td>
                                  <StatusIndicator status={row.status} />
                                </td>
                              </tr>
                            )),
                          ],
                    )}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 sm:hidden">
                {(["income", "deductions", "summary"] as RowGroup[]).map(
                  (group) =>
                    grouped[group].length === 0 ? null : (
                      <div key={group} className="space-y-2">
                        <p className="label-caps opacity-70">
                          {GROUP_TITLES[group]}
                        </p>
                        {grouped[group].map((row) => (
                          <div
                            key={row.code ?? row.key ?? row.description}
                            className={`rounded-box border p-3 ${
                              row.status === "mismatch"
                                ? "border-error/40 bg-error/10"
                                : "border-base-300 bg-base-100"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-medium">
                                {row.description}
                                {row.code ? (
                                  <span className="ml-2 font-mono text-xs opacity-60">
                                    {row.code}
                                  </span>
                                ) : null}
                              </p>
                              <StatusIndicator status={row.status} />
                            </div>
                            <dl className="mt-2 grid grid-cols-2 gap-1 text-sm">
                              <dt className="opacity-60">Yours</dt>
                              <dd className="currency text-right">
                                {row.mineAmount === null
                                  ? "not calculated"
                                  : formatRand(row.mineAmount)}
                              </dd>
                              <dt className="opacity-60">SARS</dt>
                              <dd className="currency text-right">
                                {row.sarsAmount === null && !originallyMissing(row)
                                  ? ""
                                  : row.sarsAmount !== null
                                    ? formatRand(row.sarsAmount)
                                    : ""}
                              </dd>
                              {row.delta !== null ? (
                                <>
                                  <dt className="opacity-60">Delta</dt>
                                  <dd className="currency text-right">
                                    {formatRand(row.delta)}
                                  </dd>
                                </>
                              ) : null}
                            </dl>
                            {originallyMissing(row) ? (
                              <div className="mt-2">
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
                                      [row.code
                                        ? `code:${row.code}`
                                        : row.key!]: amount,
                                    }))
                                  }
                                />
                              </div>
                            ) : null}
                            {row.status === "mismatch" ? (
                              <div className="mt-1">
                                <WhyRow steps={traceForRow(row, trace)} />
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ),
                )}
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
        </>
      ) : null}

      {objectionLines.length > 0 ? (
        <section className="card border border-base-300 bg-base-100 shadow-sm print:border-none print:shadow-none">
          <div className="card-body">
            <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
              <h3 className="card-title text-base">Objection summary</h3>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() =>
                  downloadTextFile(
                    `objection-summary-${tables.id}.txt`,
                    objectionText,
                  )
                }
              >
                Download summary (.txt)
              </button>
            </div>
            <p className="text-sm opacity-70 print:hidden">
              For your own reference when completing a Notice of Objection on
              SARS eFiling. Not tax advice, not a submission, and not a
              guarantee that SARS&apos;s figure is wrong, use it to check the
              underlying documents before disputing anything.
            </p>
            <div className="space-y-4">
              {objectionLines.map((line) => (
                <div
                  key={line.code ?? line.key ?? line.description}
                  className="border-t border-base-300 pt-3 first:border-t-0 first:pt-0"
                >
                  <p className="font-mono text-xs opacity-60">
                    {line.code ?? line.key ?? ""}
                  </p>
                  <p className="font-semibold">{line.description}</p>
                  <p className="text-sm opacity-80">{line.reasoning}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
