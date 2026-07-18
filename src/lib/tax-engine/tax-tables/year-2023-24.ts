import type { TaxYearTables } from "../types";

/*
 * 2023/24 tax year (SARS 2024 year of assessment), 1 March 2023 to
 * 29 February 2024 (2024 is a leap year). Brackets, rebates, thresholds,
 * and medical credits were adjusted for inflation in the February 2023
 * Budget and then frozen: the same figures carried forward unchanged
 * through 2024/25 and 2025/26.
 *
 * Sources, verified 2026-07-18:
 * - SARS, Archive Tax Rates (individuals, 2024 year of assessment)
 *   https://www.sars.gov.za/tax-rates/archive-tax-rates/
 * - SARS, Rates per kilometre / PAYE-GEN-01-G03-A01 schedule (R4.64/km for
 *   years of assessment commencing 1 March 2023)
 *   https://www.sars.gov.za/tax-rates/employers/rates-per-kilometre/
 */
export const year2023_24: TaxYearTables = {
  id: "2023-24",
  label: "2023/24",
  sarsYear: 2024,
  periodStart: "2023-03-01",
  periodEnd: "2024-02-29",
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
    reimbursiveRatePerKm: 4.64,
  },
  // SARS eLogbook fixed cost table, 1 March 2023 to 29 February 2024.
  travelDeemedCost: [
    { maxVehicleValue: 100_000, fixedCost: 33_760, fuelCentsPerKm: 141.5, maintenanceCentsPerKm: 43.8 },
    { maxVehicleValue: 200_000, fixedCost: 60_329, fuelCentsPerKm: 158.0, maintenanceCentsPerKm: 54.8 },
    { maxVehicleValue: 300_000, fixedCost: 86_958, fuelCentsPerKm: 171.7, maintenanceCentsPerKm: 60.4 },
    { maxVehicleValue: 400_000, fixedCost: 110_554, fuelCentsPerKm: 184.6, maintenanceCentsPerKm: 65.9 },
    { maxVehicleValue: 500_000, fixedCost: 134_150, fuelCentsPerKm: 197.6, maintenanceCentsPerKm: 77.5 },
    { maxVehicleValue: 600_000, fixedCost: 158_856, fuelCentsPerKm: 226.6, maintenanceCentsPerKm: 91.0 },
    { maxVehicleValue: 700_000, fixedCost: 183_611, fuelCentsPerKm: 230.5, maintenanceCentsPerKm: 102.1 },
    { maxVehicleValue: 800_000, fixedCost: 209_685, fuelCentsPerKm: 234.3, maintenanceCentsPerKm: 113.1 },
    { maxVehicleValue: null, fixedCost: 209_685, fuelCentsPerKm: 234.3, maintenanceCentsPerKm: 113.1 },
  ],
  cgt: {
    inclusionRate: 0.4,
    annualExclusion: 40_000,
    deathYearExclusion: 300_000,
    primaryResidenceExclusion: 2_000_000,
  },
};
