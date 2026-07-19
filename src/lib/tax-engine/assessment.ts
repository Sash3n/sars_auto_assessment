import {
  aggregatePayslips,
  anyDisability,
  monthlySchemeHeadcount,
  netCapitalGains,
  netFreelanceIncome,
  netRentalIncome,
} from "@/lib/model/aggregate";
import type { TaxYearData } from "@/lib/model/types";
import { isIsoDate } from "@/lib/model/validate";
import { taxBeforeRebates } from "./brackets";
import { taxableCapitalGain } from "./cgt";
import { homeOfficeDeduction } from "./home-office";
import { splitExemptInterest } from "./interest";
import { travelDeduction } from "./travel";
import {
  additionalMedicalCredit,
  annualMedicalSchemeCredit,
} from "./medical";
import { roundToCent } from "./money";
import { ageAtTaxYearEnd, totalRebates } from "./rebates";
import { retirementDeduction } from "./retirement";
import type { TaxYearTables } from "./types";

/*
 * Composes every captured income and deduction source into a full
 * assessment matching the ITA34 structure: income by SARS code, deductions
 * allowed, taxable income, assessed tax after rebates, tax credits and
 * adjustments, and the net result. Sign convention matches SARS: a positive
 * result is payable by the taxpayer, a negative result is a refund.
 */

export interface AssessmentLine {
  code?: string;
  description: string;
  amount: number;
}

export interface Assessment {
  taxYearId: string;
  age: number;
  incomeLines: AssessmentLine[];
  incomeTotal: number;
  deductionLines: AssessmentLine[];
  deductionsTotal: number;
  taxableIncome: number;
  taxBeforeRebates: number;
  rebates: number;
  medicalSchemeCredit: number;
  additionalMedicalCredit: number;
  assessedTaxAfterRebates: number;
  /** PAYE withheld, SARS code 4102, applied as a credit. */
  paye: number;
  assessmentResult: number;
  netAmount: number;
  /** SARS "Rating percentage": tax over taxable income. */
  effectiveRatePercent: number;
  provisionalTaxpayerLikely: boolean;
  retirement: {
    contributions: number;
    allowed: number;
    carriedForward: number;
  };
  interest: { total: number; exempt: number; taxable: number };
  cgt: { netGains: number; taxable: number };
  uif: number;
  employers: string[];
  warnings: string[];
}

/*
 * Threshold above which non-remuneration taxable income makes provisional
 * registration likely, carried forward from the prototype's logic.
 */
const PROVISIONAL_INCOME_THRESHOLD = 30_000;

export function composeAssessment(
  year: TaxYearData,
  tables: TaxYearTables,
): Assessment {
  const warnings: string[] = [];

  let age: number;
  if (isIsoDate(year.profile.dateOfBirth)) {
    age = ageAtTaxYearEnd(year.profile.dateOfBirth, tables);
  } else {
    age = 40;
    warnings.push(
      "Date of birth is missing, so under-65 rebates and exemptions are assumed. Capture it under Deductions for accurate age-based amounts.",
    );
  }

  const payroll = aggregatePayslips(year.payslips);
  const interest = splitExemptInterest(year.localInterest, age, tables);
  const rental = netRentalIncome(year.rentals);
  const freelance = netFreelanceIncome(year.freelance);
  const netGains = netCapitalGains(year.disposals, tables);
  const taxableGain = taxableCapitalGain({ netGains }, tables);

  if (rental < 0) {
    warnings.push(
      "The rental result is a loss. It is offset against other income here; SARS may ring-fence recurring rental losses (section 20A).",
    );
  }

  const incomeLines: AssessmentLine[] = [];
  if (payroll.income3601 > 0) {
    incomeLines.push({
      code: "3601",
      description: "Income, taxable",
      amount: payroll.income3601,
    });
  }
  if (payroll.annualPayments3605 > 0) {
    incomeLines.push({
      code: "3605",
      description: "Annual payment, taxable",
      amount: payroll.annualPayments3605,
    });
  }
  if (payroll.allowances3713 > 0) {
    incomeLines.push({
      code: "3713",
      description: "Other allowances, taxable",
      amount: payroll.allowances3713,
    });
  }
  if (payroll.otherFringe3801 > 0) {
    incomeLines.push({
      code: "3801",
      description: "General fringe benefits",
      amount: payroll.otherFringe3801,
    });
  }
  if (payroll.medicalFringe3805 > 0) {
    incomeLines.push({
      code: "3805",
      description: "Medical scheme fringe benefit",
      amount: payroll.medicalFringe3805,
    });
  }
  if (payroll.retirementFringe3817 > 0) {
    incomeLines.push({
      code: "3817",
      description: "Pension fund contributions fringe benefit",
      amount: payroll.retirementFringe3817,
    });
  }
  if (year.localInterest > 0) {
    incomeLines.push({
      code: "4201",
      description: "Local interest (excluding SARS interest)",
      amount: year.localInterest,
    });
    if (interest.exempt > 0) {
      incomeLines.push({
        description: "Less: exempt local interest",
        amount: -interest.exempt,
      });
    }
  }
  if (rental !== 0) {
    incomeLines.push({
      code: "4210",
      description: "Net rental income",
      amount: rental,
    });
  }
  if (freelance > 0) {
    incomeLines.push({
      description: "Freelance and side income",
      amount: freelance,
    });
  }
  if (taxableGain > 0) {
    incomeLines.push({
      code: "4250",
      description: "Taxable capital gain",
      amount: taxableGain,
    });
  }

  const incomeTotal = roundToCent(
    payroll.grossPayrollIncome +
      interest.taxable +
      rental +
      freelance +
      taxableGain,
  );

  /*
   * Section 11F. The percentage base uses the greater of remuneration or
   * taxable income before this deduction; the hard limit excludes the
   * taxable capital gain (section 11F(2)(c) read with section 26A), so the
   * base passed here is income before the deduction and before the gain.
   */
  const retirementContributions = roundToCent(
    payroll.retirementContributions +
      year.profile.privateRetirementContributions +
      year.carryForward.retirementExcessPrior,
  );
  const retirement = retirementDeduction(
    {
      contributions: retirementContributions,
      remuneration: payroll.grossPayrollIncome,
      taxableIncomeBeforeDeduction: roundToCent(incomeTotal - taxableGain),
    },
    tables,
  );

  const deductionLines: AssessmentLine[] = [];
  if (retirement.allowed > 0) {
    deductionLines.push({
      code: "4029",
      description: "Retirement fund contributions",
      amount: -retirement.allowed,
    });
  }
  if (retirement.carriedForward > 0) {
    warnings.push(
      `Retirement contributions of R ${retirement.carriedForward.toFixed(2)} exceed this year's limit and carry forward to next year, they are not lost.`,
    );
  }
  const travelClaim = year.travel ?? {
    allowanceReceived: 0,
    totalKm: 0,
    businessKm: 0,
    vehicleValue: 0,
    paidFullFuel: true,
    paidFullMaintenance: true,
  };
  const travel = travelDeduction(travelClaim, tables);
  if (travel.allowed > 0) {
    deductionLines.push({
      description: "Travel expenses against allowance (logbook)",
      amount: -travel.allowed,
    });
    if (travel.deemedCost > travel.allowed) {
      warnings.push(
        `The deemed travel cost of R ${travel.deemedCost.toFixed(2)} exceeds the allowance received, so the travel deduction is capped at R ${travel.allowed.toFixed(2)}.`,
      );
    }
  } else if (travelClaim.allowanceReceived > 0) {
    warnings.push(
      "A travel allowance is captured but the logbook details (kilometres and vehicle value) are incomplete, so no travel deduction is claimed.",
    );
  }

  const homeOffice = homeOfficeDeduction({
    directExpenses: year.profile.homeOfficeExpenses,
    runningCosts: year.profile.homeOfficeRunningCosts ?? 0,
    officeAreaM2: year.profile.homeOfficeAreaM2 ?? 0,
    homeAreaM2: year.profile.homeTotalAreaM2 ?? 0,
  });
  if (homeOffice.total > 0) {
    deductionLines.push({
      description: "Home office expenses",
      amount: -homeOffice.total,
    });
  }

  /*
   * Section 18A caps the donations deduction at 10 percent of taxable
   * income after every other deduction but before the donations deduction
   * itself. The disallowed excess carries forward to the next year.
   */
  const donationsClaimed = roundToCent(
    year.profile.donations +
      (year.profile.donationCertificates ?? []).reduce(
        (total, certificate) => total + certificate.amount,
        0,
      ),
  );
  const donationsBase = roundToCent(
    Math.max(
      0,
      incomeTotal - retirement.allowed - travel.allowed - homeOffice.total,
    ),
  );
  const donationsCap = roundToCent(donationsBase * 0.1);
  const donationsAllowed = roundToCent(
    Math.min(donationsClaimed, donationsCap),
  );
  if (donationsAllowed > 0) {
    deductionLines.push({
      code: "4011",
      description: "Section 18A donations",
      amount: -donationsAllowed,
    });
  }
  if (donationsClaimed > donationsAllowed) {
    warnings.push(
      `Section 18A donations of R ${donationsClaimed.toFixed(2)} exceed the 10 percent of taxable income limit of R ${donationsCap.toFixed(2)}. The excess carries forward to next year, it is not lost.`,
    );
  }

  const deductionsTotal = roundToCent(
    retirement.allowed + travel.allowed + homeOffice.total + donationsAllowed,
  );
  const taxableIncome = roundToCent(Math.max(0, incomeTotal - deductionsTotal));

  const grossTax = taxBeforeRebates(taxableIncome, tables);
  const rebates = taxableIncome > 0 ? totalRebates(age, tables) : 0;

  const headcounts = monthlySchemeHeadcount(year.profile, year.dependents);
  const schemeCredit = annualMedicalSchemeCredit(headcounts, tables);
  const contributionsPaid = roundToCent(
    payroll.employerMedicalContributions +
      year.profile.privateMedicalContributions,
  );
  const extraMedical = additionalMedicalCredit({
    age,
    hasDisability: anyDisability(year.profile, year.dependents),
    contributionsPaid,
    annualSchemeCredit: schemeCredit,
    qualifyingExpenses: year.profile.qualifyingMedicalExpenses,
    taxableIncome,
  });

  const assessedTaxAfterRebates = roundToCent(
    Math.max(0, grossTax - rebates - schemeCredit - extraMedical),
  );
  const assessmentResult = roundToCent(assessedTaxAfterRebates - payroll.paye);

  const nonPayeIncome = roundToCent(
    interest.taxable + Math.max(0, rental) + freelance,
  );

  return {
    taxYearId: year.taxYearId,
    age,
    incomeLines,
    incomeTotal,
    deductionLines,
    deductionsTotal,
    taxableIncome,
    taxBeforeRebates: grossTax,
    rebates,
    medicalSchemeCredit: schemeCredit,
    additionalMedicalCredit: extraMedical,
    assessedTaxAfterRebates,
    paye: payroll.paye,
    assessmentResult,
    netAmount: assessmentResult,
    effectiveRatePercent:
      taxableIncome > 0
        ? Math.round((assessedTaxAfterRebates / taxableIncome) * 10_000) / 100
        : 0,
    provisionalTaxpayerLikely: nonPayeIncome > PROVISIONAL_INCOME_THRESHOLD,
    retirement: {
      contributions: retirementContributions,
      allowed: retirement.allowed,
      carriedForward: retirement.carriedForward,
    },
    interest: {
      total: year.localInterest,
      exempt: interest.exempt,
      taxable: interest.taxable,
    },
    cgt: { netGains, taxable: taxableGain },
    uif: payroll.uif,
    employers: payroll.employers,
    warnings,
  };
}
