import type { TaxYearTables } from "../types";

/*
 * 2024/25 tax year (SARS 2025 year of assessment), 1 March 2024 to
 * 28 February 2025. The February 2024 Budget made no changes to brackets,
 * rebates, thresholds, or medical credits, carrying 2023/24 forward
 * unchanged (a widely reported bracket freeze); the March 2025 Budget then
 * did the same again into 2025/26.
 *
 * Sources, verified 2026-07-18:
 * - SARS, Rates of Tax for Individuals
 *   https://www.sars.gov.za/tax-rates/income-tax/rates-of-tax-for-individuals/
 * - SARS, Archive Tax Rates (individuals, 2025 year of assessment)
 *   https://www.sars.gov.za/tax-rates/archive-tax-rates/
 * - SARS, Rates per kilometre / PAYE-GEN-01-G03-A01 schedule (R4.84/km for
 *   years of assessment commencing 1 March 2024)
 *   https://www.sars.gov.za/tax-rates/employers/rates-per-kilometre/
 */
export const year2024_25: TaxYearTables = {
  id: "2024-25",
  label: "2024/25",
  sarsYear: 2025,
  periodStart: "2024-03-01",
  periodEnd: "2025-02-28",
  brackets: [
    { above: 0, upTo: 237_100, base: 0, rate: 0.18 },
    { above: 237_100, upTo: 370_500, base: 42_678, rate: 0.26 },
    { above: 370_500, upTo: 512_800, base: 77_362, rate: 0.31 },
    { above: 512_800, upTo: 673_000, base: 121_475, rate: 0.36 },
    { above: 673_000, upTo: 857_900, base: 179_147, rate: 0.39 },
    { above: 857_900, upTo: 1_817_000, base: 251_258, rate: 0.41 },
    { above: 1_817_000, upTo: null, base: 644_489, rate: 0.45 },
  ],
  rebates: {
    primary: 17_235,
    secondary: 9_444,
    tertiary: 3_145,
  },
  thresholds: {
    under65: 95_750,
    from65to74: 148_217,
    from75: 165_689,
  },
  medicalCredit: {
    mainMemberMonthly: 364,
    firstDependantMonthly: 364,
    additionalDependantMonthly: 246,
  },
  retirement: {
    rate: 0.275,
    annualCap: 350_000,
  },
  interestExemption: {
    under65: 23_800,
    from65: 34_500,
  },
  travel: {
    reimbursiveRatePerKm: 4.84,
  },
  cgt: {
    inclusionRate: 0.4,
    annualExclusion: 40_000,
    deathYearExclusion: 300_000,
    primaryResidenceExclusion: 2_000_000,
  },
};
