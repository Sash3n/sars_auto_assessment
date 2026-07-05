import { DEFAULT_TAX_YEAR_ID } from "@/lib/tax-engine/tax-tables";
import { newId } from "./ids";
import type {
  AppData,
  Dependent,
  Payslip,
  RentalProperty,
  TaxpayerProfile,
  TaxYearData,
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
    homeOfficeExpenses: 0,
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
    carryForward: { retirementExcessPrior: 0 },
  };
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
