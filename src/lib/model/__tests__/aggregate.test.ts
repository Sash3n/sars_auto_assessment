import { describe, expect, it } from "vitest";
import {
  aggregatePayslips,
  anyDisability,
  monthlySchemeHeadcount,
  netCapitalGains,
  netFreelanceIncome,
  netRentalIncome,
} from "@/lib/model/aggregate";
import { emptyDependent, emptyPayslip } from "@/lib/model/defaults";
import type { Payslip } from "@/lib/model/types";
import { getTaxYear } from "@/lib/tax-engine/tax-tables";

const y2025 = getTaxYear("2025-26");

function slip(overrides: Partial<Payslip>): Payslip {
  return { ...emptyPayslip("2025-03"), ...overrides };
}

describe("aggregatePayslips", () => {
  it("maps payslip fields to SARS source code totals", () => {
    const totals = aggregatePayslips([
      slip({
        employer: "Acme",
        basicSalary: 30_000,
        annualBonus: 10_000,
        leavePay: 2_000,
        allowances: [
          { id: "a1", label: "Phone", amount: 500 },
          { id: "a2", label: "Tool", amount: 300 },
        ],
        otherFringeBenefits: [{ id: "f1", label: "Gym", amount: 400 }],
        employerMedicalAid: 1_500,
        employerRetirement: 2_500,
        employeeRetirement: 1_800,
        paye: 6_000,
        uif: 177.12,
        nonTaxDeductions: [{ id: "n1", label: "Loan", amount: 900 }],
      }),
    ]);
    expect(totals.income3601).toBe(30_000);
    expect(totals.annualPayments3605).toBe(12_000);
    expect(totals.allowances3713).toBe(800);
    expect(totals.otherFringe3801).toBe(400);
    expect(totals.medicalFringe3805).toBe(1_500);
    expect(totals.retirementFringe3817).toBe(2_500);
    expect(totals.paye).toBe(6_000);
    expect(totals.uif).toBe(177.12);
    expect(totals.retirementContributions).toBe(4_300);
    expect(totals.nonTaxDeductions).toBe(900);
    expect(totals.grossPayrollIncome).toBe(
      30_000 + 12_000 + 800 + 400 + 1_500 + 2_500,
    );
  });

  it("supports multiple employers and more than 12 payslips", () => {
    const slips = [
      ...Array.from({ length: 8 }, (_, index) =>
        slip({
          employer: "First Employer",
          periodMonth: `2025-0${(index % 9) + 1}`,
          basicSalary: 20_000,
          paye: 3_000,
        }),
      ),
      ...Array.from({ length: 6 }, () =>
        slip({ employer: "Second Employer", basicSalary: 25_000, paye: 4_000 }),
      ),
    ];
    const totals = aggregatePayslips(slips);
    expect(slips.length).toBeGreaterThan(12);
    expect(totals.employers).toHaveLength(2);
    expect(totals.income3601).toBe(8 * 20_000 + 6 * 25_000);
    expect(totals.paye).toBe(8 * 3_000 + 6 * 4_000);
  });

  it("returns zeros for no payslips", () => {
    const totals = aggregatePayslips([]);
    expect(totals.grossPayrollIncome).toBe(0);
    expect(totals.employers).toHaveLength(0);
  });
});

describe("netRentalIncome", () => {
  it("nets income against expenses with apportionment", () => {
    const net = netRentalIncome([
      {
        id: "r1",
        name: "Flat",
        rentalIncome: 120_000,
        expenses: [
          { id: "e1", label: "Levies", amount: 24_000 },
          { id: "e2", label: "Rates", amount: 12_000 },
        ],
        apportionmentPercent: 50,
      },
    ]);
    expect(net).toBe(42_000);
  });

  it("allows a rental loss", () => {
    const net = netRentalIncome([
      {
        id: "r1",
        name: "Flat",
        rentalIncome: 50_000,
        expenses: [{ id: "e1", label: "Interest", amount: 80_000 }],
        apportionmentPercent: 100,
      },
    ]);
    expect(net).toBe(-30_000);
  });
});

describe("netFreelanceIncome", () => {
  it("sums items and floors each at zero", () => {
    const net = netFreelanceIncome([
      { id: "f1", description: "Design", income: 40_000, expenses: 10_000 },
      { id: "f2", description: "Bad gig", income: 5_000, expenses: 9_000 },
    ]);
    expect(net).toBe(30_000);
  });
});

describe("netCapitalGains", () => {
  it("applies the primary residence exclusion per disposal", () => {
    const net = netCapitalGains(
      [
        {
          id: "d1",
          description: "House",
          proceeds: 3_500_000,
          baseCost: 1_000_000,
          isPrimaryResidence: true,
        },
      ],
      y2025,
    );
    // Gain 2 500 000 less the 2 000 000 primary residence exclusion.
    expect(net).toBe(500_000);
  });

  it("offsets losses against gains", () => {
    const net = netCapitalGains(
      [
        {
          id: "d1",
          description: "Shares up",
          proceeds: 150_000,
          baseCost: 100_000,
          isPrimaryResidence: false,
        },
        {
          id: "d2",
          description: "Shares down",
          proceeds: 60_000,
          baseCost: 80_000,
          isPrimaryResidence: false,
        },
      ],
      y2025,
    );
    expect(net).toBe(30_000);
  });
});

describe("monthlySchemeHeadcount", () => {
  it("builds a per-month headcount from taxpayer and dependents", () => {
    const months = monthlySchemeHeadcount({ medicalSchemeMonths: 12 }, [
      { ...emptyDependent(), medicalSchemeMonths: 12 },
      { ...emptyDependent(), medicalSchemeMonths: 6 },
    ]);
    expect(months).toHaveLength(12);
    expect(months[0]).toBe(3);
    expect(months[5]).toBe(3);
    expect(months[6]).toBe(2);
    expect(months[11]).toBe(2);
  });

  it("handles no cover at all", () => {
    expect(monthlySchemeHeadcount({ medicalSchemeMonths: 0 }, [])).toEqual(
      Array(12).fill(0),
    );
  });
});

describe("anyDisability", () => {
  it("is true when a dependent has a disability", () => {
    expect(
      anyDisability({ hasDisability: false }, [
        { ...emptyDependent(), hasDisability: true },
      ]),
    ).toBe(true);
  });

  it("is false when nobody has a disability", () => {
    expect(anyDisability({ hasDisability: false }, [emptyDependent()])).toBe(
      false,
    );
  });
});
