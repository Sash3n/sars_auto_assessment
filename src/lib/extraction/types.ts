/*
 * Shared shapes for the extraction pipeline. Extraction is local-first:
 * PDF text layer, then on-device OCR, and only then an explicit, consented
 * cloud LLM fallback.
 */

export type ExtractionSource = "pdf-text" | "ocr" | "llm" | "paste";

/** Payslip fields the pipeline can suggest values for. */
export type ExtractableField =
  | "employer"
  | "periodMonth"
  | "basicSalary"
  | "annualBonus"
  | "leavePay"
  | "allowance"
  | "employeeRetirement"
  | "employerRetirement"
  | "employerMedicalAid"
  | "otherFringeBenefit"
  | "paye"
  | "uif"
  | "nonTaxDeduction";

export interface FieldSuggestion {
  field: ExtractableField;
  /** Amount fields carry numbers; employer and periodMonth carry strings. */
  value: number | string;
  /** For named list fields (allowances and similar), the detected label. */
  label?: string;
  /** 0 to 1. Surfaced to the user, never silently trusted. */
  confidence: number;
  /** The raw text the suggestion came from, for the user to verify. */
  evidence: string;
  source: ExtractionSource;
}

export interface ExtractionOutcome {
  suggestions: FieldSuggestion[];
  rawText: string;
  source: ExtractionSource;
  warnings: string[];
}

export type ConfidenceLevel = "high" | "medium" | "low";

export function confidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence >= 0.8) {
    return "high";
  }
  if (confidence >= 0.55) {
    return "medium";
  }
  return "low";
}
