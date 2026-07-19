import { aggregatePayslips, anyDisability } from "@/lib/model/aggregate";
import type { TaxYearData } from "@/lib/model/types";
import { formatRand } from "@/lib/format";
import type { Assessment, AssessmentLine } from "@/lib/tax-engine/assessment";
import type { TaxYearTables } from "@/lib/tax-engine/types";

/*
 * Reshapes an already-computed Assessment into the section layout of a SARS
 * ITA34 Notice of Assessment: Details, Balance of Account, Assessment
 * Summary Information, Tax calculation, Income and Deductions allowed with
 * the reference document's two amount columns (Computations & adjustments
 * for component figures, Amount assessed for the signed contribution),
 * Taxable income, and numbered Notes.
 *
 * Boundary rule: no tax is calculated here, only presented. Every monetary
 * total comes from the Assessment or the year's tables. The raw TaxYearData
 * is consulted solely to describe captured inputs (the retirement build-up
 * split, the medical contributions detail), never to derive a new rand
 * figure the engine did not already produce.
 */

export interface StatementRow {
  code?: string;
  description: string;
  /** "Computations & adjustments" column. Undefined renders blank. */
  computation?: number;
  /** "Amount assessed" column. Undefined renders blank. */
  amount?: number;
  /** Section headers, sub totals, and totals. */
  emphasis?: boolean;
  /** Uncoded build-up and detail sub-rows. */
  indent?: boolean;
  /** Full-width caption row explaining a limit, no amount columns. */
  narrative?: boolean;
}

export interface StatementSection {
  title: string;
  rows: StatementRow[];
  total: number;
}

export interface StatementNote {
  heading: string;
  /** Trailing amount shown on the heading row, per the reference layout. */
  amount?: number;
  rows?: { label: string; value: string }[];
  /** Free-form sentences that do not fit the label:value shape. */
  paragraphs?: string[];
}

export interface StatementDocument {
  meta: {
    yearLabel: string;
    generatedAt: string;
    disclaimer: string;
  };
  details: {
    yearOfAssessment: string;
    dateGenerated: string;
    typeOfDocument: string;
  };
  balanceOfAccount: { description: string; amount: number };
  summary: StatementRow[];
  taxCalculation: StatementRow[];
  income: StatementSection[];
  incomeTotal: number;
  deductions: StatementSection[];
  deductionsTotal: number;
  taxableIncome: { amount: number; ratingPercent: number };
  notes: StatementNote[];
}

export const STATEMENT_DISCLAIMER =
  "Independent estimate, not an official SARS document.";

function employmentSection(lines: AssessmentLine[]): StatementSection | null {
  const employment = lines.filter(
    (line) =>
      line.code &&
      (line.code.startsWith("36") ||
        line.code.startsWith("37") ||
        line.code.startsWith("38")),
  );
  if (employment.length === 0) {
    return null;
  }
  return {
    title: "Employment income [IRP5/IT3(a)]",
    rows: employment.map((line) => ({
      code: line.code,
      description: line.description,
      computation: line.amount,
      amount: line.amount,
    })),
    total: employment.reduce((sum, line) => sum + line.amount, 0),
  };
}

function interestSection(assessment: Assessment): StatementSection | null {
  if (assessment.interest.total <= 0) {
    return null;
  }
  const rows: StatementRow[] = [
    {
      code: "4201",
      description: "Local interest (excluding SARS interest)",
      computation: assessment.interest.total,
    },
  ];
  if (assessment.interest.exempt > 0) {
    rows.push({
      description: "Investment exemption",
      computation: -assessment.interest.exempt,
      indent: true,
    });
  }
  return {
    title: "Local Interest Income",
    rows,
    total: assessment.interest.taxable,
  };
}

function singleLineSection(
  line: AssessmentLine | undefined,
  title: string,
): StatementSection | null {
  if (!line) {
    return null;
  }
  return {
    title,
    rows: [
      {
        code: line.code,
        description: line.description,
        computation: line.amount,
        amount: line.amount,
      },
    ],
    total: line.amount,
  };
}

function otherIncomeSection(lines: AssessmentLine[]): StatementSection | null {
  const other = lines.filter(
    (line) => !line.code && !/exempt local interest/i.test(line.description),
  );
  if (other.length === 0) {
    return null;
  }
  return {
    title: "Other Income",
    rows: other.map((line) => ({
      description: line.description,
      computation: line.amount,
      amount: line.amount,
    })),
    total: other.reduce((sum, line) => sum + line.amount, 0),
  };
}

function buildIncomeSections(assessment: Assessment): StatementSection[] {
  const lines = assessment.incomeLines;
  return [
    employmentSection(lines),
    interestSection(assessment),
    singleLineSection(
      lines.find((line) => line.code === "4210"),
      "Local Rental Income",
    ),
    otherIncomeSection(lines),
    singleLineSection(
      lines.find((line) => line.code === "4250"),
      "Capital Gains",
    ),
  ].filter((section): section is StatementSection => section !== null);
}

function retirementSection(
  assessment: Assessment,
  tables: TaxYearTables,
  year: TaxYearData,
): StatementSection | null {
  const line = assessment.deductionLines.find((entry) => entry.code === "4029");
  if (!line) {
    return null;
  }
  const payroll = aggregatePayslips(year.payslips);
  const taxableIncomeExcludingCgt =
    assessment.incomeTotal - assessment.cgt.taxable;
  const rows: StatementRow[] = [
    {
      code: "4029",
      description: "Retirement fund contributions",
      computation: assessment.retirement.contributions,
      amount: line.amount,
    },
    {
      description: "Amount b/f from previous year",
      computation: year.carryForward.retirementExcessPrior,
      indent: true,
    },
    {
      description: "Pension and provident fund contributions",
      computation: payroll.retirementContributions,
      indent: true,
    },
    {
      description: "Retirement annuity fund contributions",
      computation: year.profile.privateRetirementContributions,
      indent: true,
    },
    {
      description: `Deduction limited to lesser of ${formatRand(
        tables.retirement.annualCap,
      )} or (${(tables.retirement.rate * 100).toLocaleString("en-ZA", {
        maximumFractionDigits: 1,
      })}% of the greater of the taxable income ${formatRand(
        taxableIncomeExcludingCgt,
      )} or remuneration ${formatRand(assessment.remuneration)})`,
      narrative: true,
    },
    {
      description: `Deduction limited to Taxable income excluding CGT ${formatRand(
        taxableIncomeExcludingCgt,
      )}, excess amount ${formatRand(
        assessment.retirement.carriedForward,
      )} included in carry-over amount`,
      narrative: true,
    },
  ];
  return {
    title: "Retirement fund contributions",
    rows,
    total: line.amount,
  };
}

function buildDeductionSections(
  assessment: Assessment,
  tables: TaxYearTables,
  year: TaxYearData,
): StatementSection[] {
  const sections: StatementSection[] = [];
  const retirement = retirementSection(assessment, tables, year);
  if (retirement) {
    sections.push(retirement);
  }
  for (const line of assessment.deductionLines) {
    if (line.code === "4029") {
      continue;
    }
    sections.push({
      title: line.description,
      rows: [
        {
          code: line.code,
          description: line.description,
          computation: -line.amount,
          amount: line.amount,
        },
      ],
      total: line.amount,
    });
  }
  return sections;
}

function buildTaxCalculation(
  assessment: Assessment,
  tables: TaxYearTables,
): StatementRow[] {
  const refund = assessment.netAmount < 0;
  const totalRebatesAndCredits =
    assessment.rebates +
    assessment.medicalSchemeCredit +
    assessment.additionalMedicalCredit;

  const rows: StatementRow[] = [
    { description: "Normal tax", amount: assessment.taxBeforeRebates },
  ];

  if (totalRebatesAndCredits > 0) {
    rows.push({
      description: "Rebates",
      amount: -totalRebatesAndCredits,
      emphasis: true,
    });
    if (assessment.rebates > 0) {
      rows.push({
        description: "Primary",
        computation: tables.rebates.primary,
        indent: true,
      });
      if (assessment.age >= 65) {
        rows.push({
          description: "Secondary (65 and older)",
          computation: tables.rebates.secondary,
          indent: true,
        });
      }
      if (assessment.age >= 75) {
        rows.push({
          description: "Tertiary (75 and older)",
          computation: tables.rebates.tertiary,
          indent: true,
        });
      }
    }
    if (assessment.medicalSchemeCredit > 0) {
      rows.push({
        description: "Medical Scheme Fees Tax Credit",
        computation: assessment.medicalSchemeCredit,
        indent: true,
      });
    }
    if (assessment.additionalMedicalCredit > 0) {
      rows.push({
        description: "Additional Medical Expenses Tax Credit",
        computation: assessment.additionalMedicalCredit,
        indent: true,
      });
    }
  }

  rows.push({
    description: "Sub total",
    amount: assessment.assessedTaxAfterRebates,
    emphasis: true,
  });

  if (assessment.paye > 0) {
    rows.push({
      description: "Employees' tax",
      amount: -assessment.paye,
      emphasis: true,
    });
    // The reference lists one 4102 line per PAYE reconciliation event. The
    // engine only carries the aggregate, so a single line stands in.
    rows.push({
      code: "4102",
      description: "PAYE - pay as you earn",
      computation: assessment.paye,
      indent: true,
    });
  }

  rows.push({
    description: refund
      ? "Net amount refundable under this assessment"
      : "Net amount payable under this assessment",
    amount: assessment.assessmentResult,
    emphasis: true,
  });

  return rows;
}

function buildNotes(
  assessment: Assessment,
  tables: TaxYearTables,
  year: TaxYearData,
): StatementNote[] {
  const notes: StatementNote[] = [];

  const medicalCredits =
    assessment.medicalSchemeCredit + assessment.additionalMedicalCredit;
  if (medicalCredits > 0) {
    const payroll = aggregatePayslips(year.payslips);
    const contributions =
      payroll.employerMedicalContributions +
      year.profile.privateMedicalContributions;
    const band = assessment.age < 65 ? "below 65" : "65 and older";
    const disability = anyDisability(year.profile, year.dependents)
      ? "with a disability"
      : "without a disability";
    const rows: { label: string; value: string }[] = [
      {
        label: "Contributions made to medical aid",
        value: formatRand(contributions),
      },
      {
        label: "Medical Scheme Fees Tax Credit",
        value: formatRand(assessment.medicalSchemeCredit),
      },
    ];
    if (assessment.additionalMedicalCredit > 0) {
      rows.push({
        label: "Additional Medical Expenses Tax Credit",
        value: formatRand(assessment.additionalMedicalCredit),
      });
    }
    notes.push({
      heading: `Medical Rebates for persons ${band} ${disability}`,
      amount: medicalCredits,
      rows,
    });
  }

  if (assessment.cgt.netGains > 0) {
    notes.push({
      heading: "Capital gains",
      amount: assessment.cgt.taxable,
      rows: [
        {
          label: "Net capital gain before exclusion and inclusion",
          value: formatRand(assessment.cgt.netGains),
        },
        {
          label: "Annual exclusion",
          value: formatRand(tables.cgt.annualExclusion),
        },
        {
          label: "Inclusion rate",
          value: `${(tables.cgt.inclusionRate * 100).toFixed(0)}%`,
        },
        {
          label: "Taxable capital gain",
          value: formatRand(assessment.cgt.taxable),
        },
      ],
    });
  }

  if (assessment.warnings.length > 0) {
    notes.push({
      heading: "Information that impacts this estimate",
      paragraphs: [...assessment.warnings],
    });
  }

  return notes;
}

export function buildStatementDocument(
  assessment: Assessment,
  tables: TaxYearTables,
  year: TaxYearData,
): StatementDocument {
  const refund = assessment.netAmount < 0;

  return {
    meta: {
      yearLabel: tables.label,
      generatedAt: new Date().toISOString(),
      disclaimer: STATEMENT_DISCLAIMER,
    },
    details: {
      yearOfAssessment: tables.label,
      dateGenerated: new Date().toISOString().slice(0, 10),
      typeOfDocument: "Independent estimate",
    },
    balanceOfAccount: {
      description: refund
        ? "Refund due to you"
        : "Amount payable by you to SARS",
      amount: Math.abs(assessment.netAmount),
    },
    summary: [
      { description: "Income", amount: assessment.incomeTotal },
      {
        description: "Deductions allowed",
        amount: -assessment.deductionsTotal,
      },
      {
        description: "Taxable income / Assessed Loss",
        amount: assessment.taxableIncome,
        emphasis: true,
      },
      { description: "Calculated Tax Liability:", emphasis: true },
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
    taxCalculation: buildTaxCalculation(assessment, tables),
    income: buildIncomeSections(assessment),
    incomeTotal: assessment.incomeTotal,
    deductions: buildDeductionSections(assessment, tables, year),
    deductionsTotal: -assessment.deductionsTotal,
    taxableIncome: {
      amount: assessment.taxableIncome,
      ratingPercent: assessment.effectiveRatePercent,
    },
    notes: buildNotes(assessment, tables, year),
  };
}
