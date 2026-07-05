import { describe, expect, it } from "vitest";
import { emptyAppData, emptyPayslip, emptyRental } from "@/lib/model/defaults";
import { storeReducer } from "@/lib/store/reducer";

describe("storeReducer", () => {
  it("creates an empty year when switching to a new tax year", () => {
    const state = storeReducer(emptyAppData(), {
      type: "setActiveYear",
      taxYearId: "2026-27",
    });
    expect(state.activeTaxYearId).toBe("2026-27");
    expect(state.years["2026-27"]).toBeDefined();
    expect(state.years["2026-27"].payslips).toEqual([]);
    // The original year is untouched.
    expect(state.years["2025-26"]).toBeDefined();
  });

  it("keeps existing data when switching back to a known year", () => {
    let state = emptyAppData();
    const payslip = { ...emptyPayslip("2025-03"), employer: "Acme" };
    state = storeReducer(state, { type: "upsertPayslip", payslip });
    state = storeReducer(state, {
      type: "setActiveYear",
      taxYearId: "2026-27",
    });
    state = storeReducer(state, {
      type: "setActiveYear",
      taxYearId: "2025-26",
    });
    expect(state.years["2025-26"].payslips).toHaveLength(1);
  });

  it("upserts and removes payslips in the active year", () => {
    let state = emptyAppData();
    const payslip = { ...emptyPayslip("2025-04"), employer: "Acme" };
    state = storeReducer(state, { type: "upsertPayslip", payslip });
    expect(state.years["2025-26"].payslips).toHaveLength(1);

    state = storeReducer(state, {
      type: "upsertPayslip",
      payslip: { ...payslip, employer: "Acme Renamed" },
    });
    expect(state.years["2025-26"].payslips).toHaveLength(1);
    expect(state.years["2025-26"].payslips[0].employer).toBe("Acme Renamed");

    state = storeReducer(state, { type: "removePayslip", id: payslip.id });
    expect(state.years["2025-26"].payslips).toHaveLength(0);
  });

  it("updates the profile with a partial patch", () => {
    const state = storeReducer(emptyAppData(), {
      type: "updateProfile",
      patch: { dateOfBirth: "1990-06-15", medicalSchemeMonths: 12 },
    });
    const profile = state.years["2025-26"].profile;
    expect(profile.dateOfBirth).toBe("1990-06-15");
    expect(profile.medicalSchemeMonths).toBe(12);
    expect(profile.hasDisability).toBe(false);
  });

  it("manages rentals, interest, dividends, and carry-forward", () => {
    let state = emptyAppData();
    const rental = { ...emptyRental(), name: "Flat" };
    state = storeReducer(state, { type: "upsertRental", rental });
    state = storeReducer(state, { type: "setLocalInterest", amount: 25_000 });
    state = storeReducer(state, { type: "setLocalDividends", amount: 8_000 });
    state = storeReducer(state, {
      type: "setRetirementExcessPrior",
      amount: 15_000,
    });
    const year = state.years["2025-26"];
    expect(year.rentals[0].name).toBe("Flat");
    expect(year.localInterest).toBe(25_000);
    expect(year.localDividends).toBe(8_000);
    expect(year.carryForward.retirementExcessPrior).toBe(15_000);

    state = storeReducer(state, { type: "removeRental", id: rental.id });
    expect(state.years["2025-26"].rentals).toHaveLength(0);
  });

  it("resets only the active year", () => {
    let state = emptyAppData();
    state = storeReducer(state, {
      type: "upsertPayslip",
      payslip: { ...emptyPayslip("2025-03"), employer: "Acme" },
    });
    state = storeReducer(state, { type: "resetYear" });
    expect(state.years["2025-26"].payslips).toHaveLength(0);
  });

  it("does not mutate the previous state", () => {
    const before = emptyAppData();
    const frozen = JSON.stringify(before);
    storeReducer(before, {
      type: "upsertPayslip",
      payslip: emptyPayslip("2025-03"),
    });
    expect(JSON.stringify(before)).toBe(frozen);
  });
});
