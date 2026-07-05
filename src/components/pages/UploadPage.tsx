"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { applySuggestionsToPayslip, mergeSuggestions } from "@/lib/extraction/apply";
import { extractPayslipSuggestions } from "@/lib/extraction/heuristics";
import { clearApiKey, loadApiKey, saveApiKey } from "@/lib/extraction/keyStore";
import {
  ANTHROPIC_MODEL,
  CloudExtractionError,
  extractWithAnthropic,
} from "@/lib/extraction/llm";
import { extractPdfText, looksLikeScannedPdf } from "@/lib/extraction/pdf";
import { extractImageText } from "@/lib/extraction/ocr";
import {
  confidenceLevel,
  type ExtractionOutcome,
  type FieldSuggestion,
} from "@/lib/extraction/types";
import { formatRand } from "@/lib/format";
import { emptyPayslip } from "@/lib/model/defaults";
import { monthsOfTaxYear } from "@/lib/model/months";
import { useStore } from "@/lib/store/StoreProvider";
import { getTaxYear } from "@/lib/tax-engine/tax-tables";

interface SuggestionRow extends FieldSuggestion {
  rowId: string;
  included: boolean;
}

const FIELD_LABELS: Record<string, string> = {
  employer: "Employer",
  periodMonth: "Month",
  basicSalary: "Basic salary",
  annualBonus: "Annual bonus",
  leavePay: "Leave pay",
  allowance: "Allowance",
  employeeRetirement: "Employee retirement",
  employerRetirement: "Employer retirement (3817)",
  employerMedicalAid: "Employer medical aid (3805)",
  otherFringeBenefit: "Other fringe benefit",
  paye: "PAYE",
  uif: "UIF",
  nonTaxDeduction: "Non-tax deduction",
};

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const level = confidenceLevel(confidence);
  const className =
    level === "high"
      ? "badge badge-success badge-sm rounded-full"
      : level === "medium"
        ? "badge badge-warning badge-sm rounded-full"
        : "badge badge-error badge-sm rounded-full";
  return (
    <span className={className}>
      {level} {Math.round(confidence * 100)}%
    </span>
  );
}

function toRows(suggestions: FieldSuggestion[]): SuggestionRow[] {
  return suggestions.map((suggestion, index) => ({
    ...suggestion,
    rowId: `row-${index}-${suggestion.field}`,
    included: confidenceLevel(suggestion.confidence) !== "low",
  }));
}

export default function UploadPage() {
  const { state, dispatch } = useStore();
  const [rawText, setRawText] = useState("");
  const [pasted, setPasted] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [outcome, setOutcome] = useState<ExtractionOutcome | null>(null);
  const [rows, setRows] = useState<SuggestionRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [rememberKey, setRememberKey] = useState(false);
  const [cloudBusy, setCloudBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function runHeuristics(text: string, source: "paste" | "pdf-text" | "ocr") {
    const result = extractPayslipSuggestions(text, source);
    setRawText(text);
    setOutcome(result);
    setRows(toRows(result.suggestions));
    setSaved(false);
  }

  async function handleFile(file: File) {
    setError(null);
    setOutcome(null);
    setRows([]);
    setSaved(false);
    try {
      if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
        setBusy("Reading the PDF text layer, locally in your browser");
        const text = await extractPdfText(await file.arrayBuffer());
        if (looksLikeScannedPdf(text)) {
          setError(
            "This PDF has no usable text layer, it is probably a scan. Upload it as an image (screenshot or photo) so local OCR can read it, or paste the text.",
          );
          return;
        }
        runHeuristics(text, "pdf-text");
      } else if (file.type.startsWith("image/")) {
        setBusy("Running OCR locally in your browser, nothing is uploaded");
        setOcrProgress(0);
        const { text } = await extractImageText(file, setOcrProgress);
        runHeuristics(text, "ocr");
      } else {
        setError("Unsupported file type. Upload a PDF or an image.");
      }
    } catch {
      setError(
        "The file could not be processed locally. Try pasting the payslip text instead.",
      );
    } finally {
      setBusy(null);
    }
  }

  function updateRow(rowId: string, patch: Partial<SuggestionRow>) {
    setRows((current) =>
      current.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row)),
    );
  }

  function handleSave() {
    const months = monthsOfTaxYear(getTaxYear(state.activeTaxYearId));
    const included = rows.filter((row) => row.included);
    const payslip = applySuggestionsToPayslip(
      included,
      emptyPayslip(months[0].value),
    );
    dispatch({ type: "upsertPayslip", payslip });
    setSaved(true);
  }

  async function handleCloudSend() {
    setCloudBusy(true);
    setError(null);
    try {
      const cloud = await extractWithAnthropic(apiKey, rawText);
      if (rememberKey) {
        saveApiKey(apiKey);
      }
      const local = outcome?.suggestions ?? [];
      const merged = mergeSuggestions(
        local,
        cloud,
      );
      setRows(toRows(merged));
      setConsentOpen(false);
      setConsentChecked(false);
    } catch (cause) {
      setError(
        cause instanceof CloudExtractionError
          ? cause.message
          : "Cloud extraction failed. Capture the fields manually instead.",
      );
    } finally {
      setCloudBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Upload a payslip</h2>
        <p className="mt-1 text-sm opacity-70">
          Extraction is local-first: the PDF text layer, then on-device OCR.
          Nothing leaves your browser unless you explicitly choose the cloud
          fallback.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card border border-base-300 bg-base-100 shadow-sm">
          <div className="card-body">
            <h3 className="card-title text-base">Upload a file</h3>
            <p className="text-sm opacity-70">
              PDF payslips are read from their text layer. Images are read
              with local OCR. Scanned PDFs: upload as an image instead.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,image/png,image/jpeg,image/webp"
              className="file-input file-input-bordered w-full"
              aria-label="Payslip file"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void handleFile(file);
                }
              }}
            />
            {busy ? (
              <div className="mt-2 space-y-2">
                <p className="text-sm opacity-70">{busy}</p>
                {ocrProgress > 0 ? (
                  <progress
                    className="progress progress-primary w-full"
                    value={ocrProgress}
                    max={1}
                    aria-label="OCR progress"
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="card border border-base-300 bg-base-100 shadow-sm">
          <div className="card-body">
            <h3 className="card-title text-base">Or paste the raw text</h3>
            <textarea
              className="textarea textarea-bordered min-h-28 w-full"
              placeholder="Paste the payslip text here"
              aria-label="Pasted payslip text"
              value={pasted}
              onChange={(event) => setPasted(event.target.value)}
            />
            <div className="card-actions justify-end">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={pasted.trim() === ""}
                onClick={() => runHeuristics(pasted, "paste")}
              >
                Analyse text
              </button>
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <div role="alert" className="alert alert-error">
          <span>{error}</span>
        </div>
      ) : null}

      {outcome ? (
        <section
          className="card border border-base-300 bg-base-100 shadow-sm"
          aria-labelledby="suggestions-heading"
        >
          <div className="card-body">
            <h3 id="suggestions-heading" className="card-title text-base">
              Suggested fields
            </h3>
            {outcome.warnings.length > 0 ? (
              <ul className="space-y-1">
                {outcome.warnings.map((warning) => (
                  <li key={warning} className="alert alert-warning py-2 text-sm">
                    {warning}
                  </li>
                ))}
              </ul>
            ) : null}
            {rows.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th aria-label="Include" />
                      <th>Field</th>
                      <th>Value</th>
                      <th>Confidence</th>
                      <th>Evidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.rowId} className="hover:bg-base-200">
                        <td>
                          <input
                            type="checkbox"
                            className="checkbox checkbox-primary checkbox-sm"
                            checked={row.included}
                            aria-label={`Include ${FIELD_LABELS[row.field] ?? row.field}`}
                            onChange={(event) =>
                              updateRow(row.rowId, {
                                included: event.target.checked,
                              })
                            }
                          />
                        </td>
                        <td>
                          {FIELD_LABELS[row.field] ?? row.field}
                          {row.label ? (
                            <span className="block text-xs opacity-60">
                              {row.label}
                            </span>
                          ) : null}
                        </td>
                        <td className="currency">
                          {typeof row.value === "number"
                            ? formatRand(row.value)
                            : row.value}
                        </td>
                        <td>
                          <ConfidenceBadge confidence={row.confidence} />
                        </td>
                        <td className="max-w-64 truncate text-xs opacity-60">
                          {row.evidence}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm opacity-70">
                No fields recognised. Try the cloud fallback below, or capture
                the payslip manually.
              </p>
            )}
            <div className="card-actions items-center justify-between">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => {
                  setApiKey(loadApiKey());
                  setRememberKey(loadApiKey() !== "");
                  setConsentOpen(true);
                }}
              >
                Results wrong or incomplete? Try cloud extraction
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={rows.every((row) => !row.included)}
                onClick={handleSave}
              >
                Add to payslips
              </button>
            </div>
            {saved ? (
              <div role="status" className="alert alert-success">
                <span>
                  Payslip added. Review and complete it on the{" "}
                  <Link href="/income" className="link">
                    Income page
                  </Link>
                  .
                </span>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {consentOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="consent-heading"
          className="fixed inset-0 z-50 flex items-center justify-center bg-neutral/60 p-4"
        >
          <div className="card w-full max-w-lg border border-base-300 bg-base-100 shadow-xl">
            <div className="card-body gap-4">
              <h3 id="consent-heading" className="card-title text-base">
                Send this payslip text to the Anthropic API?
              </h3>
              <div className="space-y-2 text-sm">
                <p>
                  The extracted payslip text (shown on this page) will be sent
                  over the internet to{" "}
                  <span className="font-mono">api.anthropic.com</span>, using
                  the model <span className="font-mono">{ANTHROPIC_MODEL}</span>.
                  It leaves your browser and this device.
                </p>
                <p>
                  The request goes directly from your browser to Anthropic
                  using your own API key. It never passes through any server
                  belonging to this app, and the key is stored only on this
                  device, never in your cloud data.
                </p>
              </div>
              <label className="form-control w-full">
                <span className="label-caps mb-1 block opacity-70">
                  Your Anthropic API key
                </span>
                <input
                  type="password"
                  className="input input-bordered w-full"
                  value={apiKey}
                  aria-label="Anthropic API key"
                  placeholder="sk-ant-..."
                  onChange={(event) => setApiKey(event.target.value)}
                />
              </label>
              <div className="flex flex-wrap items-center gap-4">
                <label className="label cursor-pointer justify-start gap-2">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={rememberKey}
                    aria-label="Remember key on this device"
                    onChange={(event) => {
                      setRememberKey(event.target.checked);
                      if (!event.target.checked) {
                        clearApiKey();
                      }
                    }}
                  />
                  <span className="text-sm">Remember key on this device</span>
                </label>
              </div>
              <label className="label cursor-pointer items-start justify-start gap-3">
                <input
                  type="checkbox"
                  className="checkbox checkbox-primary"
                  checked={consentChecked}
                  aria-label="I consent to sending this payslip text to Anthropic"
                  onChange={(event) => setConsentChecked(event.target.checked)}
                />
                <span className="text-sm">
                  I understand this payslip text is about to leave my browser
                  and be sent to Anthropic, and I consent to that for this
                  extraction.
                </span>
              </label>
              <div className="card-actions justify-end">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setConsentOpen(false);
                    setConsentChecked(false);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!consentChecked || apiKey.trim() === "" || cloudBusy}
                  onClick={() => void handleCloudSend()}
                >
                  {cloudBusy ? "Sending..." : "Send to Anthropic"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
