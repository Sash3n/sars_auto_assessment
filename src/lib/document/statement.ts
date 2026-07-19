import type { Assessment, AssessmentLine } from "@/lib/tax-engine/assessment";
import type { TaxYearTables } from "@/lib/tax-engine/types";

/*
 * Reshapes an already-computed Assessment into the section layout of a SARS
 * ITA34 Notice of Assessment: Balance of Account, Assessment Summary
 * Information, Tax calculation, Income (grouped by category), Deductions
 * allowed, Taxable income, and Notes. No tax is calculated here, only
 * presented, so this stays outside tax-engine.
 */

export interface StatementRow {
  code?: string;
  description: string;
  amount: number;
  emphasis?: boolean;
}

export interface StatementSection {
  title: string;
  rows: StatementRow[];
  total: number;
}

export interface StatementDocument {
  meta: {
    yearLabel: string;
    generatedAt: string;
    disclaimer: string;
  };
  balanceOfAccount: { description: string; amount: number };
  summary: StatementRow[];
  taxCalculation: StatementRow[];
  income: StatementSection[];
  deductions: StatementSection[];
  taxableIncome: { amount: number; ratingPercent: number };
  notes: string[];
}

export const STATEMENT_DISCLAIMER =
  "Independent estimate, not an official SARS document.";

const INCOME_CATEGORY_ORDER = [
  "Employment income [IRP5/IT3(a)]",
  "Local Interest Income",
  "Local Rental Income",
  "Other Income",
  "Capital Gains",
];

function incomeCategoryFor(line: AssessmentLine): string {
  if (line.code && (line.code.startsWith("36") || line.code.startsWith("38"))) {
    return "Employment income [IRP5/IT3(a)]";
  }
  if (line.code === "4201") {
    return "Local Interest Income";
  }
  if (!line.code && /exempt local interest/i.test(line.description)) {
    return "Local Interest Income";
  }
  if (line.code === "4210") {
    return "Local Rental Income";
  }
  if (line.code === "4250") {
    return "Capital Gains";
  }
  return "Other Income";
}

function groupIncomeLines(lines: AssessmentLine[]): StatementSection[] {
  const byCategory = new Map<string, AssessmentLine[]>();
  for (const line of lines) {
    const category = incomeCategoryFor(line);
    const existing = byCategory.get(category);
    if (existing) {
      existing.push(line);
    } else {
      byCategory.set(category, [line]);
    }
  }
  return INCOME_CATEGORY_ORDER.filter((category) =>
    byCategory.has(category),
  ).map((category) => {
    const categoryLines = byCategory.get(category)!;
    return {
      title: category,
      rows: categoryLines.map((line) => ({
        code: line.code,
        description: line.description,
        amount: line.amount,
      })),
      total: categoryLines.reduce((sum, line) => sum + line.amount, 0),
    };
  });
}

function groupDeductionLines(lines: AssessmentLine[]): StatementSection[] {
  if (lines.length === 0) {
    return [];
  }
  return [
    {
      title: "Deductions allowed",
      rows: lines.map((line) => ({
        code: line.code,
        description: line.description,
        amount: line.amount,
      })),
      total: lines.reduce((sum, line) => sum + line.amount, 0),
    },
  ];
}

function buildNotes(assessment: Assessment, tables: TaxYearTables): string[] {
  const notes: string[] = [];
  if (assessment.interest.exempt > 0) {
    notes.push(
      `Local interest exemption applied under section 10(1)(i): R ${assessment.interest.exempt.toFixed(2)} of R ${assessment.interest.total.toFixed(2)} local interest is exempt.`,
    );
  }
  if (assessment.retirement.contributions > 0) {
    notes.push(
      `Retirement fund contributions are deductible under section 11F up to the lesser of R ${tables.retirement.annualCap.toFixed(2)} or ${(tables.retirement.rate * 100).toFixed(1)}% of the greater of remuneration or taxable income.`,
    );
  }
  if (assessment.cgt.netGains > 0) {
    notes.push(
      `Capital gains are included at ${(tables.cgt.inclusionRate * 100).toFixed(0)}% after the annual exclusion of R ${tables.cgt.annualExclusion.toFixed(2)}.`,
    );
  }
  return [...notes, ...assessment.warnings];
}

export function buildStatementDocument(
  assessment: Assessment,
  tables: TaxYearTables,
): StatementDocument {
  const refund = assessment.netAmount < 0;

  return {
    meta: {
      yearLabel: tables.label,
      generatedAt: new Date().toISOString(),
      disclaimer: STATEMENT_DISCLAIMER,
    },
    balanceOfAccount: {
      description: refund
        ? "Refund due to you"
        : "Amount payable by you to SARS",
      amount: Math.abs(assessment.netAmount),
    },
    summary: [
      { description: "Income", amount: assessment.incomeTotal },
      { description: "Deductions allowed", amount: -assessment.deductionsTotal },
      {
        description: "Taxable income / Assessed Loss",
        amount: assessment.taxableIncome,
        emphasis: true,
      },
      {
        description: "Assessed tax after rebates",
        amount: assessment.assessedTaxAfterRebates,
      },
      {
        description: "Tax credits and adjustments",
        amount: -assessment.paye,
      },
      {
        description: "Assessment Result",
        amount: assessment.assessmentResult,
        emphasis: true,
      },
    ],
    taxCalculation: [
      {
        description: "Normal tax on taxable income",
        amount: assessment.taxBeforeRebates,
      },
      {
        description: `Rebates (age ${assessment.age})`,
        amount: -assessment.rebates,
      },
      ...(assessment.medicalSchemeCredit > 0
        ? [
            {
              description: "Medical Scheme Fees Tax Credit (s6A)",
              amount: -assessment.medicalSchemeCredit,
            },
          ]
        : []),
      ...(assessment.additionalMedicalCredit > 0
        ? [
            {
              description: "Additional Medical Expenses Tax Credit (s6B)",
              amount: -assessment.additionalMedicalCredit,
            },
          ]
        : []),
      {
        description: "Sub total",
        amount: assessment.assessedTaxAfterRebates,
        emphasis: true,
      },
      {
        code: "4102",
        description: "Employees' tax (PAYE)",
        amount: -assessment.paye,
      },
      {
        description: refund
          ? "Net amount refundable"
          : "Net amount payable",
        amount: assessment.assessmentResult,
        emphasis: true,
      },
    ],
    income: groupIncomeLines(assessment.incomeLines),
    deductions: groupDeductionLines(assessment.deductionLines),
    taxableIncome: {
      amount: assessment.taxableIncome,
      ratingPercent: assessment.effectiveRatePercent,
    },
    notes: buildNotes(assessment, tables),
  };
}
