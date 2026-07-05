import { emptyAppData, emptyYear } from "@/lib/model/defaults";
import type {
  AppData,
  CapitalDisposal,
  Dependent,
  FreelanceItem,
  Payslip,
  RentalProperty,
  TaxpayerProfile,
  TaxYearData,
} from "@/lib/model/types";

export type StoreAction =
  | { type: "hydrate"; data: AppData }
  | { type: "setActiveYear"; taxYearId: string }
  | { type: "updateProfile"; patch: Partial<TaxpayerProfile> }
  | { type: "upsertPayslip"; payslip: Payslip }
  | { type: "removePayslip"; id: string }
  | { type: "upsertRental"; rental: RentalProperty }
  | { type: "removeRental"; id: string }
  | { type: "upsertFreelance"; item: FreelanceItem }
  | { type: "removeFreelance"; id: string }
  | { type: "upsertDisposal"; disposal: CapitalDisposal }
  | { type: "removeDisposal"; id: string }
  | { type: "upsertDependent"; dependent: Dependent }
  | { type: "removeDependent"; id: string }
  | { type: "setLocalInterest"; amount: number }
  | { type: "setLocalDividends"; amount: number }
  | { type: "setRetirementExcessPrior"; amount: number }
  | { type: "resetYear" };

function upsertById<T extends { id: string }>(list: T[], item: T): T[] {
  const index = list.findIndex((existing) => existing.id === item.id);
  if (index === -1) {
    return [...list, item];
  }
  return list.map((existing) => (existing.id === item.id ? item : existing));
}

function withActiveYear(
  state: AppData,
  update: (year: TaxYearData) => TaxYearData,
): AppData {
  const current =
    state.years[state.activeTaxYearId] ?? emptyYear(state.activeTaxYearId);
  return {
    ...state,
    years: {
      ...state.years,
      [state.activeTaxYearId]: update(current),
    },
  };
}

export function storeReducer(state: AppData, action: StoreAction): AppData {
  switch (action.type) {
    case "hydrate":
      return action.data;
    case "setActiveYear": {
      const years = state.years[action.taxYearId]
        ? state.years
        : {
            ...state.years,
            [action.taxYearId]: emptyYear(action.taxYearId),
          };
      return { ...state, activeTaxYearId: action.taxYearId, years };
    }
    case "updateProfile":
      return withActiveYear(state, (year) => ({
        ...year,
        profile: { ...year.profile, ...action.patch },
      }));
    case "upsertPayslip":
      return withActiveYear(state, (year) => ({
        ...year,
        payslips: upsertById(year.payslips, action.payslip),
      }));
    case "removePayslip":
      return withActiveYear(state, (year) => ({
        ...year,
        payslips: year.payslips.filter((slip) => slip.id !== action.id),
      }));
    case "upsertRental":
      return withActiveYear(state, (year) => ({
        ...year,
        rentals: upsertById(year.rentals, action.rental),
      }));
    case "removeRental":
      return withActiveYear(state, (year) => ({
        ...year,
        rentals: year.rentals.filter((rental) => rental.id !== action.id),
      }));
    case "upsertFreelance":
      return withActiveYear(state, (year) => ({
        ...year,
        freelance: upsertById(year.freelance, action.item),
      }));
    case "removeFreelance":
      return withActiveYear(state, (year) => ({
        ...year,
        freelance: year.freelance.filter((item) => item.id !== action.id),
      }));
    case "upsertDisposal":
      return withActiveYear(state, (year) => ({
        ...year,
        disposals: upsertById(year.disposals, action.disposal),
      }));
    case "removeDisposal":
      return withActiveYear(state, (year) => ({
        ...year,
        disposals: year.disposals.filter(
          (disposal) => disposal.id !== action.id,
        ),
      }));
    case "upsertDependent":
      return withActiveYear(state, (year) => ({
        ...year,
        dependents: upsertById(year.dependents, action.dependent),
      }));
    case "removeDependent":
      return withActiveYear(state, (year) => ({
        ...year,
        dependents: year.dependents.filter(
          (dependent) => dependent.id !== action.id,
        ),
      }));
    case "setLocalInterest":
      return withActiveYear(state, (year) => ({
        ...year,
        localInterest: action.amount,
      }));
    case "setLocalDividends":
      return withActiveYear(state, (year) => ({
        ...year,
        localDividends: action.amount,
      }));
    case "setRetirementExcessPrior":
      return withActiveYear(state, (year) => ({
        ...year,
        carryForward: {
          ...year.carryForward,
          retirementExcessPrior: action.amount,
        },
      }));
    case "resetYear":
      return withActiveYear(state, (year) => emptyYear(year.taxYearId));
    default:
      return state;
  }
}

export function initialAppData(): AppData {
  return emptyAppData();
}
