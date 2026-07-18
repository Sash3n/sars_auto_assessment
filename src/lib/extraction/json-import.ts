import { newId } from "@/lib/model/ids";
import type { Payslip } from "@/lib/model/types";
import { clampCurrency, isIsoMonth, sanitizeLabel } from "@/lib/model/validate";

/*
 * Import path for structured payslip JSON, for example from a vision or OCR
 * tool that already parsed scanned payslips into salary-code lines, rather
 * than raw text run through the free-text heuristics pipeline. Every line is
 * classified by its description against a fixed rule set; nothing
 * recognisable is ever dropped, unclassified lines land in a catch-all and
 * are flagged for the user to check, the same "never assume zero, never
 * silently guess" posture as the rest of extraction.
 */

export interface JsonSalaryLine {
  salary_code?: string;
  type?: string;
  description: string;
  amount: number;
}

export interface JsonPayslipEntry {
  /** Free-text period label, for example "March 2025". */
  assumed_period?: string;
  /** ISO "YYYY-MM", used instead of assumed_period when already known. */
  periodMonth?: string;
  employer?: string;
  note?: string;
  earnings?: JsonSalaryLine[];
  deductions?: JsonSalaryLine[];
  /**
   * Amounts the employer pays alongside the payslip, not deducted from the
   * employee's pay: employer retirement and medical contributions, group
   * risk benefits, statutory levies. Distinct from earnings/deductions
   * because the same keyword means something different here, "medical"
   * always means the employer's contribution, never the employee's own.
   */
  company_contributions?: JsonSalaryLine[];
}

export interface JsonTaxCertificateLine {
  description: string;
  amount?: number | null;
  source_code?: string;
  code?: string;
}

export interface JsonTaxCertificate {
  income_received?: JsonTaxCertificateLine[];
  income_received_continued?: JsonTaxCertificateLine[];
  tax_credits_and_or_employer_employee_contribution?: JsonTaxCertificateLine[];
}

export interface PayslipJsonImport {
  /** Default employer for entries that do not name their own. */
  employer?: string;
  payslips: JsonPayslipEntry[];
  tax_certificate?: JsonTaxCertificate;
}

export interface JsonImportResult {
  payslips: Payslip[];
  warnings: string[];
}

const MONTH_NAMES: Record<string, string> = {
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

function parsePeriodLabel(label: string | undefined): string | null {
  if (!label) {
    return null;
  }
  const iso = label.match(/\b(20\d{2})-(0[1-9]|1[0-2])\b/);
  if (iso) {
    return `${iso[1]}-${iso[2]}`;
  }
  const named = label.match(
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(20\d{2})\b/i,
  );
  if (named) {
    const month = MONTH_NAMES[named[1].toLowerCase().slice(0, 3)];
    return `${named[2]}-${month}`;
  }
  return null;
}

type LineTarget =
  | "basicSalary"
  | "annualBonus"
  | "leavePay"
  | "employeeRetirement"
  | "employerRetirement"
  | "employerMedicalAid"
  | "paye"
  | "uif"
  | "allowance"
  | "otherFringeBenefit"
  | "nonTaxDeduction";

/*
 * Targets that normally appear on the earnings side of a payslip. Everything
 * else (paye, uif, retirement, employer medical) normally appears on the
 * deductions side. A line landing on the opposite side of its natural
 * section is treated as a correction or reversal against the running total,
 * not as new income or a new deduction: a PAYE line posted under earnings is
 * a refund of tax already accounted for, not extra taxable pay.
 */
const EARNINGS_NATURAL_TARGETS = new Set<LineTarget>([
  "basicSalary",
  "annualBonus",
  "leavePay",
  "allowance",
  "otherFringeBenefit",
]);

interface ClassifyRule {
  target: LineTarget;
  match: (description: string) => boolean;
}

const CLASSIFY_RULES: ClassifyRule[] = [
  {
    target: "paye",
    match: (d) => d.includes("paye") || d.includes("pay as you earn"),
  },
  {
    target: "uif",
    match: (d) => d.includes("uif") || d.includes("unemployment insurance"),
  },
  {
    target: "employerMedicalAid",
    match: (d) =>
      d.includes("medical") && (d.includes("employer") || d.includes("company")),
  },
  {
    target: "employerRetirement",
    match: (d) =>
      (d.includes("pension") || d.includes("provident") || d.includes("retirement")) &&
      (d.includes("employer") || d.includes("company")),
  },
  {
    target: "employeeRetirement",
    match: (d) =>
      d.includes("pension") || d.includes("provident") || d.includes("retirement annuity"),
  },
  {
    target: "annualBonus",
    match: (d) =>
      d.includes("bonus") || d.includes("13th cheque") || d.includes("thirteenth cheque"),
  },
  {
    target: "leavePay",
    match: (d) =>
      d.includes("leave pay") || d.includes("leave payout") || d.includes("leave encashment"),
  },
  {
    target: "basicSalary",
    match: (d) => d === "pay" || d.includes("basic salary") || d.includes("basic pay"),
  },
  {
    target: "allowance",
    match: (d) =>
      d.includes("overtime") ||
      d.includes("allowance") ||
      d.includes("travel") ||
      d.includes("housing") ||
      d.includes("standby") ||
      d.includes("cellphone") ||
      d.includes("telephone"),
  },
  { target: "otherFringeBenefit", match: (d) => d.includes("in lieu of benefit") },
  {
    target: "nonTaxDeduction",
    match: (d) =>
      d.includes("bargaining council") ||
      d.includes("levy") ||
      d.includes("union") ||
      d.includes("garnishee") ||
      d.includes("loan"),
  },
];

function classify(description: string): LineTarget | null {
  const normalised = description.toLowerCase().trim();
  for (const rule of CLASSIFY_RULES) {
    if (rule.match(normalised)) {
      return rule.target;
    }
  }
  return null;
}

type CompanyContributionTarget =
  | "employerMedicalAid"
  | "employerRetirement"
  | "otherFringeBenefit"
  | "ignore";

/*
 * company_contributions lines are always the employer's own contribution,
 * so the same keywords that are ambiguous in earnings/deductions are not
 * here: "medical" always means the employer medical fringe benefit (3805),
 * "pension"/"provident"/"retirement" always mean the employer retirement
 * fringe benefit (3817). The Skills Development Levy and the employer's own
 * UIF contribution are statutory employer costs, not paid for the
 * employee's benefit, so they are not fringe benefits and are ignored
 * rather than added anywhere. The employee's own UIF contribution is
 * already captured from the deductions section. Anything else the employer
 * pays here (group life, funeral cover, wellness or rewards programs) is a
 * taxable fringe benefit by default under the Seventh Schedule, unless it
 * is one of the two recognised exceptions above.
 */
function classifyCompanyContribution(
  description: string,
): CompanyContributionTarget {
  const d = description.toLowerCase().trim();
  if (d.includes("skills development levy") || d.includes("sdl")) {
    return "ignore";
  }
  if (d.includes("uif") || d.includes("unemployment insurance")) {
    return "ignore";
  }
  if (d.includes("medical")) {
    return "employerMedicalAid";
  }
  if (d.includes("pension") || d.includes("provident") || d.includes("retirement")) {
    return "employerRetirement";
  }
  return "otherFringeBenefit";
}

function emptyDraft(periodMonth: string, employer: string): Payslip {
  return {
    id: newId(),
    employer,
    periodMonth,
    basicSalary: 0,
    allowances: [],
    annualBonus: 0,
    leavePay: 0,
    employeeRetirement: 0,
    employerRetirement: 0,
    employerMedicalAid: 0,
    otherFringeBenefits: [],
    paye: 0,
    uif: 0,
    nonTaxDeductions: [],
  };
}

function applyLine(
  draft: Payslip,
  target: LineTarget,
  line: JsonSalaryLine,
  section: "earnings" | "deductions",
  periodMonth: string,
  warnings: string[],
) {
  const label = sanitizeLabel(line.description).trim() || "Amount";
  const magnitude = clampCurrency(Math.abs(line.amount));

  if (target === "nonTaxDeduction") {
    draft.nonTaxDeductions.push({ id: newId(), label, amount: magnitude });
    return;
  }

  const naturalSection = EARNINGS_NATURAL_TARGETS.has(target)
    ? "earnings"
    : "deductions";
  const sign = section === naturalSection ? 1 : -1;
  const amount = magnitude * sign;

  if (sign < 0) {
    warnings.push(
      `${periodMonth}: "${line.description}" (R ${magnitude.toFixed(2)}) was on the ${section} side, the opposite of where a ${target} line is normally found. Treated as a correction reducing the running total; verify this is right.`,
    );
  }

  switch (target) {
    case "basicSalary":
      draft.basicSalary += amount;
      break;
    case "annualBonus":
      draft.annualBonus += amount;
      break;
    case "leavePay":
      draft.leavePay += amount;
      break;
    case "employeeRetirement":
      draft.employeeRetirement += amount;
      break;
    case "employerRetirement":
      draft.employerRetirement += amount;
      break;
    case "employerMedicalAid":
      draft.employerMedicalAid += amount;
      break;
    case "paye":
      draft.paye += amount;
      break;
    case "uif":
      draft.uif += amount;
      break;
    case "allowance":
      draft.allowances.push({ id: newId(), label, amount });
      break;
    case "otherFringeBenefit":
      draft.otherFringeBenefits.push({ id: newId(), label, amount });
      break;
  }
}

const NEGATIVE_GUARD_FIELDS = [
  "basicSalary",
  "annualBonus",
  "leavePay",
  "employeeRetirement",
  "employerRetirement",
  "employerMedicalAid",
  "paye",
  "uif",
] as const;

/** Import a batch of structured payslip JSON into payslip drafts. */
export function importPayslipsFromJson(source: PayslipJsonImport): JsonImportResult {
  const warnings: string[] = [];
  const payslips: Payslip[] = [];

  for (const entry of source.payslips) {
    const periodMonth = entry.periodMonth ?? parsePeriodLabel(entry.assumed_period);
    if (!periodMonth || !isIsoMonth(periodMonth)) {
      warnings.push(
        `Could not determine the tax year month for a payslip (period label: "${entry.assumed_period ?? "unknown"}"). It was skipped; capture it manually.`,
      );
      continue;
    }

    const draft = emptyDraft(periodMonth, entry.employer ?? source.employer ?? "");
    const sections: [JsonSalaryLine[], "earnings" | "deductions"][] = [
      [entry.earnings ?? [], "earnings"],
      [entry.deductions ?? [], "deductions"],
    ];

    for (const [lines, section] of sections) {
      for (const line of lines) {
        const target = classify(line.description);
        if (!target) {
          const magnitude = clampCurrency(Math.abs(line.amount));
          const label = sanitizeLabel(line.description).trim() || "Unrecognised amount";
          if (section === "deductions") {
            draft.nonTaxDeductions.push({ id: newId(), label, amount: magnitude });
          } else {
            draft.otherFringeBenefits.push({ id: newId(), label, amount: magnitude });
          }
          const looksLikeOwnMedicalContribution =
            section === "deductions" &&
            line.description.toLowerCase().includes("medical");
          warnings.push(
            looksLikeOwnMedicalContribution
              ? `${periodMonth}: "${line.description}" (R ${magnitude.toFixed(2)}) looks like your own medical scheme contribution, deducted from pay. This app tracks that at the taxpayer level under Deductions > medical costs, not per payslip, add it there so it counts toward your medical tax credit. Kept here as a non-tax deduction for now.`
              : `${periodMonth}: unrecognised ${section} line "${line.description}" (${line.salary_code ?? "no code"}). Kept as ${
                  section === "deductions" ? "a non-tax deduction" : "a taxable fringe benefit"
                } by default; check it landed in the right place.`,
          );
          continue;
        }
        applyLine(draft, target, line, section, periodMonth, warnings);
      }
    }

    for (const line of entry.company_contributions ?? []) {
      const target = classifyCompanyContribution(line.description);
      if (target === "ignore") {
        continue;
      }
      const magnitude = clampCurrency(Math.abs(line.amount));
      const label = sanitizeLabel(line.description).trim() || "Amount";
      if (target === "employerMedicalAid") {
        draft.employerMedicalAid += magnitude;
      } else if (target === "employerRetirement") {
        draft.employerRetirement += magnitude;
      } else {
        draft.otherFringeBenefits.push({ id: newId(), label, amount: magnitude });
      }
    }

    for (const field of NEGATIVE_GUARD_FIELDS) {
      if (draft[field] < 0) {
        warnings.push(
          `${periodMonth}: ${field} came out negative after applying corrections (R ${draft[field].toFixed(2)}); clamped to zero. Check the source lines for that month.`,
        );
        draft[field] = 0;
      }
    }

    if (entry.note && /duplicate/i.test(entry.note)) {
      warnings.push(
        `${periodMonth}: source data flagged this payslip as identical to another month ("${entry.note}"). Confirm it is a genuinely separate payslip before keeping both.`,
      );
    }

    payslips.push(draft);
  }

  return { payslips, warnings };
}

export interface CrossCheckResult {
  matches: boolean;
  warnings: string[];
}

function findCertificateAmount(
  lines: JsonTaxCertificateLine[] | undefined,
  code: string,
): number | null {
  const line = lines?.find(
    (entry) => entry.source_code === code || entry.code === code,
  );
  return line?.amount ?? null;
}

function grossPayrollIncome(slip: Payslip): number {
  return (
    slip.basicSalary +
    slip.annualBonus +
    slip.leavePay +
    slip.allowances.reduce((total, item) => total + item.amount, 0) +
    slip.otherFringeBenefits.reduce((total, item) => total + item.amount, 0) +
    slip.employerMedicalAid +
    slip.employerRetirement
  );
}

/*
 * Cross-check imported payslips' annual totals against an IRP5 / tax
 * certificate summary captured alongside them, when one was provided. This
 * only compares and warns, it never overwrites a payslip figure: a mismatch
 * usually means a missing or duplicated month among the payslips.
 */
export function crossCheckAgainstTaxCertificate(
  payslips: readonly Payslip[],
  certificate: JsonTaxCertificate | undefined,
  tolerance = 1,
): CrossCheckResult {
  if (!certificate) {
    return { matches: true, warnings: [] };
  }

  const warnings: string[] = [];
  const totalGross = payslips.reduce(
    (total, slip) => total + grossPayrollIncome(slip),
    0,
  );
  const totalPaye = payslips.reduce((total, slip) => total + slip.paye, 0);

  const certificateGross =
    findCertificateAmount(certificate.income_received_continued, "3699") ??
    findCertificateAmount(certificate.income_received, "3699");
  const certificatePaye = findCertificateAmount(
    certificate.tax_credits_and_or_employer_employee_contribution,
    "4102",
  );

  if (certificateGross !== null && Math.abs(certificateGross - totalGross) > tolerance) {
    warnings.push(
      `Imported payslips total R ${totalGross.toFixed(2)} gross income, but the tax certificate (code 3699) shows R ${certificateGross.toFixed(2)}. Check for a missing or duplicated month.`,
    );
  }
  if (certificatePaye !== null && Math.abs(certificatePaye - totalPaye) > tolerance) {
    warnings.push(
      `Imported payslips total R ${totalPaye.toFixed(2)} PAYE, but the tax certificate (code 4102) shows R ${certificatePaye.toFixed(2)}. Check for a missing or duplicated month.`,
    );
  }

  return { matches: warnings.length === 0, warnings };
}
