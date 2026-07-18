import type { TaxYearTables } from "../types";

/*
 * 2025/26 tax year (SARS 2026 year of assessment), 1 March 2025 to
 * 28 February 2026. The March 2025 Budget made no changes to brackets,
 * rebates, thresholds, or medical credits, carrying 2024/25 forward.
 *
 * Sources, verified 2026-07-05:
 * - SARS, Rates of Tax for Individuals
 *   https://www.sars.gov.za/tax-rates/income-tax/rates-of-tax-for-individuals/
 * - SARS, Rates per kilometre
 *   https://www.sars.gov.za/tax-rates/employers/rates-per-kilometre/
 */
export const year2025_26: TaxYearTables = {
  id: "2025-26",
  label: "2025/26",
  sarsYear: 2026,
  periodStart: "2025-03-01",
  periodEnd: "2026-02-28",
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
    reimbursiveRatePerKm: 4.76,
  },
  // SARS eLogbook fixed cost table, 1 March 2025 to 28 February 2026.
  travelDeemedCost: [
    { maxVehicleValue: 100_000, fixedCost: 33_940, fuelCentsPerKm: 146.7, maintenanceCentsPerKm: 47.4 },
    { maxVehicleValue: 200_000, fixedCost: 60_688, fuelCentsPerKm: 163.8, maintenanceCentsPerKm: 59.3 },
    { maxVehicleValue: 300_000, fixedCost: 87_497, fuelCentsPerKm: 177.9, maintenanceCentsPerKm: 65.4 },
    { maxVehicleValue: 400_000, fixedCost: 111_273, fuelCentsPerKm: 191.4, maintenanceCentsPerKm: 71.4 },
    { maxVehicleValue: 500_000, fixedCost: 135_048, fuelCentsPerKm: 204.8, maintenanceCentsPerKm: 83.9 },
    { maxVehicleValue: 600_000, fixedCost: 159_934, fuelCentsPerKm: 234.9, maintenanceCentsPerKm: 98.5 },
    { maxVehicleValue: 700_000, fixedCost: 184_867, fuelCentsPerKm: 238.9, maintenanceCentsPerKm: 110.5 },
    { maxVehicleValue: 800_000, fixedCost: 211_121, fuelCentsPerKm: 242.9, maintenanceCentsPerKm: 122.5 },
    { maxVehicleValue: null, fixedCost: 211_121, fuelCentsPerKm: 242.9, maintenanceCentsPerKm: 122.5 },
  ],
  cgt: {
    inclusionRate: 0.4,
    annualExclusion: 40_000,
    deathYearExclusion: 300_000,
    primaryResidenceExclusion: 2_000_000,
  },
};
