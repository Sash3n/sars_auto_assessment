import { newId } from "@/lib/model/ids";
import type { Payslip } from "@/lib/model/types";
import { clampCurrency, isIsoMonth, sanitizeLabel } from "@/lib/model/validate";
import type { FieldSuggestion } from "./types";

/*
 * Turn confirmed suggestions into a payslip draft. Only fields the user kept
 * are applied; everything else keeps the base value. Nothing is assumed
 * zero: an absent suggestion leaves the base field untouched.
 */
export function applySuggestionsToPayslip(
  suggestions: readonly FieldSuggestion[],
  base: Payslip,
): Payslip {
  const draft: Payslip = {
    ...base,
    allowances: [...base.allowances],
    otherFringeBenefits: [...base.otherFringeBenefits],
    nonTaxDeductions: [...base.nonTaxDeductions],
  };

  for (const suggestion of suggestions) {
    switch (suggestion.field) {
      case "employer":
        draft.employer = sanitizeLabel(String(suggestion.value)).trim();
        break;
      case "periodMonth": {
        const month = String(suggestion.value);
        if (isIsoMonth(month)) {
          draft.periodMonth = month;
        }
        break;
      }
      case "basicSalary":
        draft.basicSalary = clampCurrency(Number(suggestion.value));
        break;
      case "annualBonus":
        draft.annualBonus = clampCurrency(Number(suggestion.value));
        break;
      case "leavePay":
        draft.leavePay = clampCurrency(Number(suggestion.value));
        break;
      case "employeeRetirement":
        draft.employeeRetirement = clampCurrency(Number(suggestion.value));
        break;
      case "employerRetirement":
        draft.employerRetirement = clampCurrency(Number(suggestion.value));
        break;
      case "employerMedicalAid":
        draft.employerMedicalAid = clampCurrency(Number(suggestion.value));
        break;
      case "paye":
        draft.paye = clampCurrency(Number(suggestion.value));
        break;
      case "uif":
        draft.uif = clampCurrency(Number(suggestion.value));
        break;
      case "allowance":
        draft.allowances.push({
          id: newId(),
          label: sanitizeLabel(suggestion.label ?? "Allowance").trim(),
          amount: clampCurrency(Number(suggestion.value)),
        });
        break;
      case "otherFringeBenefit":
        draft.otherFringeBenefits.push({
          id: newId(),
          label: sanitizeLabel(suggestion.label ?? "Fringe benefit").trim(),
          amount: clampCurrency(Number(suggestion.value)),
        });
        break;
      case "nonTaxDeduction":
        draft.nonTaxDeductions.push({
          id: newId(),
          label: sanitizeLabel(suggestion.label ?? "Deduction").trim(),
          amount: clampCurrency(Number(suggestion.value)),
        });
        break;
    }
  }
  return draft;
}

/*
 * Merge cloud results over local heuristics: for single-value fields the
 * higher-confidence source wins; list fields are combined and deduped by
 * label and amount.
 */
export function mergeSuggestions(
  local: readonly FieldSuggestion[],
  cloud: readonly FieldSuggestion[],
): FieldSuggestion[] {
  const listFields = new Set(["allowance", "otherFringeBenefit", "nonTaxDeduction"]);
  const merged = new Map<string, FieldSuggestion>();
  const lists: FieldSuggestion[] = [];
  const seenListKeys = new Set<string>();

  for (const suggestion of [...local, ...cloud]) {
    if (listFields.has(suggestion.field)) {
      const key = `${suggestion.field}:${suggestion.label ?? ""}:${suggestion.value}`;
      if (!seenListKeys.has(key)) {
        seenListKeys.add(key);
        lists.push(suggestion);
      }
      continue;
    }
    const existing = merged.get(suggestion.field);
    if (!existing || suggestion.confidence >= existing.confidence) {
      merged.set(suggestion.field, suggestion);
    }
  }
  return [...merged.values(), ...lists];
}
