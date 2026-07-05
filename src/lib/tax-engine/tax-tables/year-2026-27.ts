import type { TaxYearTables } from "../types";

/*
 * 2026/27 tax year (SARS 2027 year of assessment), 1 March 2026 to
 * 28 February 2027. The February 2026 Budget adjusted brackets, rebates,
 * thresholds, and medical credits by 3.4 percent, raised the retirement
 * deduction cap from R350 000 to R430 000 (first change since 2016), and
 * raised the CGT annual exclusion to R50 000, the death-year exclusion to
 * R440 000, and the primary residence exclusion to R3 000 000.
 *
 * Sources, verified 2026-07-05:
 * - SARS, Rates of Tax for Individuals
 *   https://www.sars.gov.za/tax-rates/income-tax/rates-of-tax-for-individuals/
 * - National Treasury, Budget 2026 Tax Guide
 *   https://www.treasury.gov.za/documents/National%20Budget/2026/sars/Budget%202026%20Tax%20guide.pdf
 * - SARS, Rates per kilometre
 *   https://www.sars.gov.za/tax-rates/employers/rates-per-kilometre/
 * - PwC Tax Summaries, South Africa income determination (CGT exclusions)
 *   https://taxsummaries.pwc.com/south-africa/individual/income-determination
 */
export const year2026_27: TaxYearTables = {
  id: "2026-27",
  label: "2026/27",
  sarsYear: 2027,
  periodStart: "2026-03-01",
  periodEnd: "2027-02-28",
  brackets: [
    { above: 0, upTo: 245_100, base: 0, rate: 0.18 },
    { above: 245_100, upTo: 383_100, base: 44_118, rate: 0.26 },
    { above: 383_100, upTo: 530_200, base: 79_998, rate: 0.31 },
    { above: 530_200, upTo: 695_800, base: 125_599, rate: 0.36 },
    { above: 695_800, upTo: 887_000, base: 185_215, rate: 0.39 },
    { above: 887_000, upTo: 1_878_600, base: 259_783, rate: 0.41 },
    { above: 1_878_600, upTo: null, base: 666_339, rate: 0.45 },
  ],
  rebates: {
    primary: 17_820,
    secondary: 9_765,
    tertiary: 3_249,
  },
  thresholds: {
    under65: 99_000,
    from65to74: 153_250,
    from75: 171_300,
  },
  medicalCredit: {
    mainMemberMonthly: 376,
    firstDependantMonthly: 376,
    additionalDependantMonthly: 254,
  },
  retirement: {
    rate: 0.275,
    annualCap: 430_000,
  },
  interestExemption: {
    under65: 23_800,
    from65: 34_500,
  },
  travel: {
    reimbursiveRatePerKm: 4.95,
  },
  cgt: {
    inclusionRate: 0.4,
    annualExclusion: 50_000,
    deathYearExclusion: 440_000,
    primaryResidenceExclusion: 3_000_000,
  },
};
