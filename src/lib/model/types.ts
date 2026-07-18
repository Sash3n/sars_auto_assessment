/*
 * The multi-source income data model. Everything a tax year's assessment is
 * built from. Amounts are annual rand values unless a field says otherwise.
 * Lists are unbounded by design: any number of employers, payslips, rentals,
 * freelance items, disposals, and dependents.
 */

export interface NamedAmount {
  id: string;
  label: string;
  amount: number;
}

export interface Payslip {
  id: string;
  /** Employer name. Mid-year job changes mean multiple employers per year. */
  employer: string;
  /** Month the payslip covers, ISO "YYYY-MM". */
  periodMonth: string;
  basicSalary: number;
  /** Each allowance named, not lumped: telephone, tool, travel, and so on. */
  allowances: NamedAmount[];
  annualBonus: number;
  leavePay: number;
  /** Employee's own retirement contribution deducted from pay. */
  employeeRetirement: number;
  /** Employer's retirement contribution, a taxable fringe benefit. */
  employerRetirement: number;
  /** Employer's medical aid contribution, a taxable fringe benefit. */
  employerMedicalAid: number;
  /** Other taxable fringe benefits, each named. */
  otherFringeBenefits: NamedAmount[];
  paye: number;
  uif: number;
  /**
   * Deductions that do not affect tax (loan repayments, garnishees, social
   * clubs). Tracked for the user's records, excluded from the calculation.
   */
  nonTaxDeductions: NamedAmount[];
}

export interface RentalProperty {
  id: string;
  name: string;
  /** Gross rental income received for the year. */
  rentalIncome: number;
  /** Deductible expenses, each named: rates, levies, interest, repairs. */
  expenses: NamedAmount[];
  /**
   * Portion of the net result attributable to the taxpayer, 0 to 100. Covers
   * shared ownership and partial-year or partial-property letting.
   */
  apportionmentPercent: number;
}

export interface FreelanceItem {
  id: string;
  description: string;
  income: number;
  /** Directly attributable deductible expenses for this item. */
  expenses: number;
}

export interface CapitalDisposal {
  id: string;
  description: string;
  proceeds: number;
  baseCost: number;
  /** Primary residence disposals get the per-disposal exclusion applied. */
  isPrimaryResidence: boolean;
}

export type DependentRelationship = "spouse" | "child" | "parent" | "other";

export interface Dependent {
  id: string;
  relationship: DependentRelationship;
  /** ISO date "YYYY-MM-DD". */
  dateOfBirth: string;
  /** SARS-recognised disability, drives the section 6B formula. */
  hasDisability: boolean;
  /** Months of the tax year this dependent was on the medical scheme, 0-12. */
  medicalSchemeMonths: number;
}

export interface TaxpayerProfile {
  /** ISO date "YYYY-MM-DD". Drives rebates and age-based exemptions. */
  dateOfBirth: string;
  hasDisability: boolean;
  /** Months of the tax year the taxpayer was the scheme's main member, 0-12. */
  medicalSchemeMonths: number;
  /**
   * Medical scheme contributions paid privately for the year, over and above
   * anything captured on payslips.
   */
  privateMedicalContributions: number;
  /** Qualifying out-of-pocket medical expenses for section 6B. */
  qualifyingMedicalExpenses: number;
  /** Private retirement annuity contributions not on any payslip. */
  privateRetirementContributions: number;
  /** Section 18A donations without individually captured certificates. */
  donations: number;
  /** Individually captured section 18A donation certificates. */
  donationCertificates: NamedAmount[];
  /** Directly claimable home office expenses (repairs to the office itself). */
  homeOfficeExpenses: number;
  /** Dedicated home office floor area in square metres. */
  homeOfficeAreaM2: number;
  /** Total floor area of the home in square metres. */
  homeTotalAreaM2: number;
  /**
   * Annual running costs of the whole home (rent or bond interest, rates,
   * electricity, cleaning), apportioned by floor area.
   */
  homeOfficeRunningCosts: number;
}

export interface TravelClaim {
  /** Travel allowance received for the year, IRP5 code 3701. */
  allowanceReceived: number;
  /** Total kilometres travelled in the year, business and private. */
  totalKm: number;
  /** Business kilometres from the logbook. */
  businessKm: number;
  /** Vehicle cost including VAT, excluding finance charges. */
  vehicleValue: number;
  paidFullFuel: boolean;
  paidFullMaintenance: boolean;
}

export interface CarryForward {
  /** Retirement contributions disallowed in prior years, section 11F. */
  retirementExcessPrior: number;
}

export interface TaxYearData {
  taxYearId: string;
  profile: TaxpayerProfile;
  payslips: Payslip[];
  rentals: RentalProperty[];
  freelance: FreelanceItem[];
  disposals: CapitalDisposal[];
  dependents: Dependent[];
  /** Local interest received for the year, SARS code 4201. */
  localInterest: number;
  /**
   * Local dividends received. Informational: dividends tax is withheld at
   * source and local dividends are exempt from normal tax.
   */
  localDividends: number;
  /** Travel allowance logbook claim for the deemed cost deduction. */
  travel: TravelClaim;
  carryForward: CarryForward;
}

export interface AppData {
  schemaVersion: 1;
  activeTaxYearId: string;
  years: Record<string, TaxYearData>;
}
