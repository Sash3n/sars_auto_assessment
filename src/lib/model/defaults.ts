import { DEFAULT_TAX_YEAR_ID } from "@/lib/tax-engine/tax-tables";
import { newId } from "./ids";
import type {
  AppData,
  Dependent,
  Payslip,
  RentalProperty,
  TaxpayerProfile,
  TaxYearData,
  TravelClaim,
} from "./types";

export function emptyProfile(): TaxpayerProfile {
  return {
    dateOfBirth: "",
    hasDisability: false,
    medicalSchemeMonths: 0,
    privateMedicalContributions: 0,
    qualifyingMedicalExpenses: 0,
    privateRetirementContributions: 0,
    donations: 0,
    donationCertificates: [],
    homeOfficeExpenses: 0,
    homeOfficeAreaM2: 0,
    homeTotalAreaM2: 0,
    homeOfficeRunningCosts: 0,
  };
}

export function emptyTravelClaim(): TravelClaim {
  return {
    allowanceReceived: 0,
    totalKm: 0,
    businessKm: 0,
    vehicleValue: 0,
    paidFullFuel: true,
    paidFullMaintenance: true,
  };
}

export function emptyYear(taxYearId: string): TaxYearData {
  return {
    taxYearId,
    profile: emptyProfile(),
    payslips: [],
    rentals: [],
    freelance: [],
    disposals: [],
    dependents: [],
    localInterest: 0,
    localDividends: 0,
    travel: emptyTravelClaim(),
    carryForward: { retirementExcessPrior: 0 },
  };
}

/*
 * Data saved by earlier app versions predates newer model fields.
 * Layering every stored year over the empty defaults guarantees the tax
 * engine never sees undefined, whether the data came from local storage
 * or a decrypted cloud backup.
 */
export function normalizeAppData(data: AppData): AppData {
  const years: Record<string, TaxYearData> = {};
  for (const [taxYearId, year] of Object.entries(data.years)) {
    years[taxYearId] = {
      ...emptyYear(taxYearId),
      ...year,
      profile: { ...emptyProfile(), ...year.profile },
      travel: { ...emptyTravelClaim(), ...year.travel },
      carryForward: {
        retirementExcessPrior: 0,
        ...year.carryForward,
      },
    };
  }
  return { ...data, years };
}

export function emptyAppData(): AppData {
  return {
    schemaVersion: 1,
    activeTaxYearId: DEFAULT_TAX_YEAR_ID,
    years: {
      [DEFAULT_TAX_YEAR_ID]: emptyYear(DEFAULT_TAX_YEAR_ID),
    },
  };
}

export function emptyPayslip(periodMonth: string): Payslip {
  return {
    id: newId(),
    employer: "",
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

export function emptyRental(): RentalProperty {
  return {
    id: newId(),
    name: "",
    rentalIncome: 0,
    expenses: [],
    apportionmentPercent: 100,
  };
}

export function emptyDependent(): Dependent {
  return {
    id: newId(),
    relationship: "child",
    dateOfBirth: "",
    hasDisability: false,
    medicalSchemeMonths: 0,
  };
}
