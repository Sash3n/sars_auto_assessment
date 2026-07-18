import type {
  ExtractableField,
  ExtractionOutcome,
  ExtractionSource,
  FieldSuggestion,
} from "./types";

/*
 * Field-suggestion heuristics over raw payslip text. Two layout realities
 * drive the design, both lessons from the previous prototype:
 *
 * 1. Label and amount are often on the same line ("Basic salary  30 000.00").
 * 2. Bordered, tabular layouts split them: the label arrives on one line and
 *    the amount one or two lines later. A same-line-only parser silently
 *    misses those, so every label match also scans a short lookahead window,
 *    at reduced confidence.
 *
 * A final or termination payslip may legitimately omit lines (no PAYE at
 * all). Heuristics therefore never invent zeros: a field with no match
 * produces no suggestion, and the UI lets the user confirm absence.
 */

interface LabelRule {
  field: ExtractableField;
  /** Lowercase substrings that identify the label. First match wins. */
  labels: string[];
  /** Substrings that veto a match (for example "employer" vetoes "uif"). */
  vetoes?: string[];
}

/*
 * Order matters: more specific rules run before generic ones, and each text
 * line can only be claimed once.
 */
const AMOUNT_RULES: LabelRule[] = [
  {
    field: "employerRetirement",
    labels: [
      "employer pension",
      "employer provident",
      "company pension",
      "company provident",
      "employer retirement",
      "er pension",
      "pension employer",
    ],
  },
  {
    field: "employerMedicalAid",
    labels: [
      "employer medical",
      "company medical",
      "medical aid employer",
      "er medical",
      "medical employer",
      "medical aid company",
    ],
  },
  {
    field: "employeeRetirement",
    labels: [
      "pension fund",
      "provident fund",
      "retirement annuity",
      "pension contribution",
      "provident contribution",
      "pension",
      "provident",
    ],
    vetoes: ["employer", "company", "fringe"],
  },
  {
    field: "paye",
    labels: ["paye", "p.a.y.e", "employees tax", "employee's tax", "income tax", "tax paid"],
    vetoes: ["total", "year to date", "ytd"],
  },
  {
    field: "uif",
    labels: ["uif", "u.i.f", "unemployment insurance"],
    vetoes: ["employer", "company", "total"],
  },
  {
    field: "annualBonus",
    labels: ["bonus", "13th cheque", "thirteenth cheque", "annual payment"],
  },
  {
    field: "leavePay",
    labels: ["leave pay", "leave payout", "leave encashment"],
  },
  {
    field: "basicSalary",
    labels: ["basic salary", "basic pay", "basic wage", "monthly salary", "basic"],
    vetoes: ["total", "cost to company"],
  },
];

/** Allowance-style lines become named allowance suggestions. */
const ALLOWANCE_HINTS = [
  "allowance",
  "cellphone",
  "cell phone",
  "telephone",
  "travel",
  "tool",
  "housing",
  "shift",
  "standby",
];

const MONTHS: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

/** Currency-looking token: optional R, grouped digits, optional cents. */
const AMOUNT_PATTERN =
  /(?:R\s*)?(\d{1,3}(?:[ ,]\d{3})+(?:\.\d{1,2})?|\d+\.\d{1,2}|\d{2,})(?!\s*%)/g;

export function parseAmountToken(token: string): number | null {
  const cleaned = token.replace(/^R\s*/i, "").replace(/[ ,]/g, "");
  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value) || value < 0) {
    return null;
  }
  return Math.round(value * 100) / 100;
}

function amountsInLine(line: string): number[] {
  const matches = line.match(AMOUNT_PATTERN) ?? [];
  return matches
    .map(parseAmountToken)
    .filter((value): value is number => value !== null && value > 0);
}

function normalise(line: string): string {
  return line.toLowerCase().replace(/\s+/g, " ").trim();
}

function matchesRule(line: string, rule: LabelRule): boolean {
  if (!rule.labels.some((label) => line.includes(label))) {
    return false;
  }
  if (rule.vetoes?.some((veto) => line.includes(veto))) {
    return false;
  }
  return true;
}

function detectPeriodMonth(lines: string[]): FieldSuggestion | null {
  for (const line of lines) {
    const iso = line.match(/\b(20\d{2})[-/](0[1-9]|1[0-2])\b/);
    if (iso) {
      return {
        field: "periodMonth",
        value: `${iso[1]}-${iso[2]}`,
        confidence: 0.85,
        evidence: line.trim(),
        source: "paste",
      };
    }
    const monthName = line.match(
      /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(20\d{2})\b/i,
    );
    if (monthName) {
      const month = MONTHS[monthName[1].toLowerCase().slice(0, 3)];
      return {
        field: "periodMonth",
        value: `${monthName[2]}-${month}`,
        confidence: 0.8,
        evidence: line.trim(),
        source: "paste",
      };
    }
    const slashed = line.match(/\b(0[1-9]|1[0-2])[-/](20\d{2})\b/);
    if (slashed) {
      return {
        field: "periodMonth",
        value: `${slashed[2]}-${slashed[1]}`,
        confidence: 0.75,
        evidence: line.trim(),
        source: "paste",
      };
    }
  }
  return null;
}

function detectEmployer(rawLines: string[]): FieldSuggestion | null {
  const companySuffix =
    /\b(pty\.?\s*ltd|ltd|inc|cc|holdings|group|consulting|solutions)\b\.?/i;
  for (const line of rawLines) {
    // The separator is mandatory: "Employer: Acme" is an employer line,
    // "Employer pension 2 500.00" is a contribution line, not a name.
    const explicit = line.match(/employer\s*[:\-]\s*(.{3,60})/i);
    if (explicit && amountsInLine(line).length === 0) {
      return {
        field: "employer",
        value: explicit[1].trim(),
        confidence: 0.85,
        evidence: line.trim(),
        source: "paste",
      };
    }
  }
  for (const line of rawLines.slice(0, 8)) {
    if (companySuffix.test(line) && amountsInLine(line).length === 0) {
      return {
        field: "employer",
        value: line.trim(),
        confidence: 0.6,
        evidence: line.trim(),
        source: "paste",
      };
    }
  }
  return null;
}

/*
 * Core routine: walk lines, match label rules, and take the amount from the
 * same line at high confidence or from a two-line lookahead window at lower
 * confidence (the bordered-layout case).
 */
export function extractPayslipSuggestions(
  rawText: string,
  source: ExtractionSource = "paste",
): ExtractionOutcome {
  const rawLines = rawText.split(/\r?\n/);
  const lines = rawLines.map(normalise);
  const suggestions: FieldSuggestion[] = [];
  const warnings: string[] = [];
  const claimedFields = new Set<ExtractableField>();
  const claimedLines = new Set<number>();

  for (const rule of AMOUNT_RULES) {
    if (claimedFields.has(rule.field)) {
      continue;
    }
    for (let index = 0; index < lines.length; index += 1) {
      if (claimedLines.has(index) || !matchesRule(lines[index], rule)) {
        continue;
      }
      const sameLine = amountsInLine(rawLines[index]);
      if (sameLine.length > 0) {
        suggestions.push({
          field: rule.field,
          value: sameLine[sameLine.length - 1],
          confidence: source === "ocr" ? 0.75 : 0.9,
          evidence: rawLines[index].trim(),
          source,
        });
        if (sameLine.length > 1) {
          warnings.push(
            `Multiple amounts found for "${rule.field}"; the right-most was used. Verify against the payslip.`,
          );
        }
        claimedFields.add(rule.field);
        claimedLines.add(index);
        break;
      }
      // Bordered layout: the amount may arrive a line or two later.
      for (let ahead = 1; ahead <= 2; ahead += 1) {
        const lookIndex = index + ahead;
        if (lookIndex >= lines.length || claimedLines.has(lookIndex)) {
          continue;
        }
        const lookAmounts = amountsInLine(rawLines[lookIndex]);
        const lookIsBareAmount =
          lookAmounts.length === 1 &&
          normalise(rawLines[lookIndex]).replace(AMOUNT_PATTERN, "").trim()
            .length <= 2;
        if (lookIsBareAmount) {
          suggestions.push({
            field: rule.field,
            value: lookAmounts[0],
            confidence: source === "ocr" ? 0.55 : 0.65,
            evidence: `${rawLines[index].trim()} / ${rawLines[lookIndex].trim()}`,
            source,
          });
          claimedFields.add(rule.field);
          claimedLines.add(index);
          claimedLines.add(lookIndex);
          break;
        }
      }
      if (claimedFields.has(rule.field)) {
        break;
      }
    }
  }

  // Named allowances: any unclaimed line that looks like an allowance.
  for (let index = 0; index < lines.length; index += 1) {
    if (claimedLines.has(index)) {
      continue;
    }
    const line = lines[index];
    if (ALLOWANCE_HINTS.some((hint) => line.includes(hint))) {
      const amounts = amountsInLine(rawLines[index]);
      if (amounts.length > 0) {
        const label = rawLines[index]
          .replace(AMOUNT_PATTERN, "")
          .replace(/R\s*$/i, "")
          .trim();
        suggestions.push({
          field: "allowance",
          value: amounts[amounts.length - 1],
          label: label || "Allowance",
          confidence: source === "ocr" ? 0.6 : 0.75,
          evidence: rawLines[index].trim(),
          source,
        });
        claimedLines.add(index);
      }
    }
  }

  const period = detectPeriodMonth(rawLines);
  if (period) {
    suggestions.push({ ...period, source });
  }
  const employer = detectEmployer(rawLines);
  if (employer) {
    suggestions.push({ ...employer, source });
  }

  if (suggestions.length === 0) {
    warnings.push(
      "No payslip fields could be recognised in the text. Try the cloud fallback or capture the fields manually.",
    );
  }
  if (!suggestions.some((entry) => entry.field === "paye")) {
    warnings.push(
      "No PAYE line was found. Final or termination payslips can legitimately omit it; confirm it is genuinely absent rather than missed.",
    );
  }

  return { suggestions, rawText, source, warnings };
}
