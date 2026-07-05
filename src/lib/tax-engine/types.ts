/*
 * Shared shapes for the tax engine. Every figure is in rand. Tables are
 * versioned per tax year: a new tax year is a new config file under
 * tax-tables/, never an edit to an existing one.
 */

export interface TaxBracket {
  /** Lower bound of the bracket, exclusive. Tax applies to income above it. */
  above: number;
  /** Upper bound of the bracket, inclusive. Null for the top bracket. */
  upTo: number | null;
  /** Cumulative tax at the lower bound, the SARS published base amount. */
  base: number;
  /** Marginal rate inside this bracket. */
  rate: number;
}

export interface TaxYearTables {
  /** Stable id used in code and storage, for example "2025-26". */
  id: string;
  /** Human label, for example "2025/26". */
  label: string;
  /** SARS year of assessment, the calendar year the period ends in. */
  sarsYear: number;
  /** First day of the tax year, ISO date. */
  periodStart: string;
  /** Last day of the tax year, ISO date. */
  periodEnd: string;
  brackets: TaxBracket[];
  /** Rebates are additive: secondary and tertiary stack on primary. */
  rebates: {
    primary: number;
    secondary: number;
    tertiary: number;
  };
  /** Below these taxable income levels no tax is payable, by age band. */
  thresholds: {
    under65: number;
    from65to74: number;
    from75: number;
  };
  /** Section 6A medical scheme fees tax credit, monthly amounts. */
  medicalCredit: {
    mainMemberMonthly: number;
    firstDependantMonthly: number;
    additionalDependantMonthly: number;
  };
  /** Section 11F retirement contribution deduction limits. */
  retirement: {
    rate: number;
    annualCap: number;
  };
  /** Section 10(1)(i) local interest exemption. */
  interestExemption: {
    under65: number;
    from65: number;
  };
  travel: {
    /** Prescribed reimbursive rate per business kilometre. */
    reimbursiveRatePerKm: number;
  };
  cgt: {
    /** Portion of the net capital gain included in taxable income. */
    inclusionRate: number;
    annualExclusion: number;
    deathYearExclusion: number;
    primaryResidenceExclusion: number;
  };
}
