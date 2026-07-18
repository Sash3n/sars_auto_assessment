import { describe, expect, it } from "vitest";
import { homeOfficeDeduction } from "@/lib/tax-engine/home-office";

/*
 * Area based home office apportionment: the office share of the home's
 * running costs is office square metres over total square metres, added
 * to directly claimable office expenses.
 */
describe("homeOfficeDeduction", () => {
  it("apportions running costs by floor area", () => {
    const result = homeOfficeDeduction({
      directExpenses: 1_500,
      runningCosts: 50_000,
      officeAreaM2: 12,
      homeAreaM2: 150,
    });
    expect(result.percent).toBeCloseTo(8, 5);
    expect(result.apportioned).toBe(4_000);
    expect(result.total).toBe(5_500);
  });

  it("claims nothing area based when areas are missing", () => {
    const result = homeOfficeDeduction({
      directExpenses: 2_000,
      runningCosts: 50_000,
      officeAreaM2: 0,
      homeAreaM2: 0,
    });
    expect(result.percent).toBe(0);
    expect(result.apportioned).toBe(0);
    expect(result.total).toBe(2_000);
  });

  it("never apportions more than the running costs", () => {
    const result = homeOfficeDeduction({
      directExpenses: 0,
      runningCosts: 10_000,
      officeAreaM2: 200,
      homeAreaM2: 100,
    });
    expect(result.percent).toBe(100);
    expect(result.apportioned).toBe(10_000);
  });
});
